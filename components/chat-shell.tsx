"use client";

import {
  ArrowLeft,
  Ban,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Clock3,
  DoorOpen,
  History,
  LoaderCircle,
  LogOut,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Send,
  Settings,
  Trash2,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UserSummary {
  id: string;
  username: string;
  online?: boolean;
  lastSeenAt?: string;
}

interface Conversation {
  user: UserSummary;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  sentByMe: boolean;
  blockedByMe: boolean;
  blockedMe: boolean;
}

interface DirectMessage {
  id: string;
  body: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  seenAt: string | null;
  expiresAt: string | null;
}

interface BlockState {
  blockedByMe: boolean;
  blockedMe: boolean;
  blocked: boolean;
}

interface GroupSummary {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
  memberCount: number;
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: string;
  lastSender: string | null;
}

interface GroupInvite {
  id: string;
  group: { id: string; name: string };
  inviterUsername: string;
  createdAt: string;
}

interface GroupMember {
  id: string;
  username: string;
  role: "OWNER" | "MEMBER";
  online: boolean;
  lastSeenAt: string;
}

interface GroupMessage {
  id: string;
  body: string;
  senderId: string;
  senderUsername: string;
  createdAt: string;
  expiresAt: string | null;
  seenByAll: boolean;
}

type SelectedChat =
  | { type: "direct"; user: UserSummary }
  | { type: "group"; group: GroupSummary };

type SidebarTab = "chats" | "groups" | "invites";
type NotificationState = "checking" | "unsupported" | "disabled" | "blocked" | "enabled" | "error";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`The server returned an unexpected response (${response.status}).`);
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat(undefined, isToday
    ? { hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric" }
  ).format(date);
}

function formatLastSeen(value?: string) {
  if (!value) return "offline";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "last seen just now";
  if (seconds < 3600) return `last seen ${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `last seen ${Math.floor(seconds / 3600)}h ago`;
  return `last seen ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value))}`;
}

function InitialBadge({ label, small = false, group = false }: { label: string; small?: boolean; group?: boolean }) {
  return (
    <div className={`relative grid shrink-0 place-items-center rounded-2xl border font-semibold uppercase ${
      group
        ? "border-sky-300/20 bg-sky-300/10 text-sky-100"
        : "border-[#8cffaa]/20 bg-[#8cffaa]/10 text-[#b9ffc9]"
    } ${small ? "size-10 text-sm" : "size-12 text-base"}`}>
      {group ? <Users size={small ? 17 : 20} /> : label.slice(0, 2)}
    </div>
  );
}

function PresenceDot({ online }: { online?: boolean }) {
  return <span className={`inline-block size-2 rounded-full ${online ? "bg-[#8cffaa]" : "bg-white/20"}`} />;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/65 p-0 backdrop-blur-sm sm:place-items-center sm:p-5" onMouseDown={onClose}>
      <div className="safe-bottom glass w-full max-w-md rounded-t-[2rem] border-white/10 p-5 sm:rounded-[2rem]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-white/45 hover:bg-white/5 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

export function ChatShell({ currentUser }: { currentUser: UserSummary }) {
  const router = useRouter();
  const [tab, setTab] = useState<SidebarTab>("chats");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [selected, setSelected] = useState<SelectedChat | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupTypingUsers, setGroupTypingUsers] = useState<string[]>([]);
  const [directTyping, setDirectTyping] = useState(false);
  const [blockState, setBlockState] = useState<BlockState>({ blocked: false, blockedByMe: false, blockedMe: false });
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<UserSummary[]>([]);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [notificationState, setNotificationState] = useState<NotificationState>("checking");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousIncomingId = useRef<string | null>(null);
  const selectedRef = useRef<SelectedChat | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingSentAtRef = useRef(0);
  const initialUrlHandledRef = useRef(false);

  selectedRef.current = selected;

  const handleUnauthorized = useCallback((response: Response) => {
    if (response.status === 401) {
      router.replace("/");
      router.refresh();
      return true;
    }
    return false;
  }, [router]);

  const playBlink = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio("/sounds/blink.wav");
    audioRef.current.currentTime = 0;
    void audioRef.current.play().catch(() => undefined);
  }, []);

  const loadOverview = useCallback(async (quiet = false) => {
    if (quiet && document.visibilityState !== "visible") return;
    if (!quiet) setLoadingOverview(true);
    try {
      const [conversationResponse, groupResponse] = await Promise.all([
        fetch("/api/conversations", { cache: "no-store" }),
        fetch("/api/groups", { cache: "no-store" })
      ]);
      if (handleUnauthorized(conversationResponse) || handleUnauthorized(groupResponse)) return;
      const conversationData = await readJson<{ conversations?: Conversation[]; error?: string }>(conversationResponse);
      const groupData = await readJson<{ groups?: GroupSummary[]; invites?: GroupInvite[]; error?: string }>(groupResponse);
      if (!conversationResponse.ok) throw new Error(conversationData.error ?? "Could not load chats");
      if (!groupResponse.ok) throw new Error(groupData.error ?? "Could not load groups");
      setConversations(conversationData.conversations ?? []);
      setGroups(groupData.groups ?? []);
      setInvites(groupData.invites ?? []);
      if (!quiet) setError("");
    } catch (loadError) {
      if (!quiet) setError(loadError instanceof Error ? loadError.message : "Could not load Blink");
    } finally {
      if (!quiet) setLoadingOverview(false);
    }
  }, [handleUnauthorized]);

  const loadDirect = useCallback(async (userId: string, quiet = false) => {
    if (quiet && document.visibilityState !== "visible") return;
    if (!quiet) setLoadingChat(true);
    try {
      const response = await fetch(`/api/messages/${userId}`, { cache: "no-store" });
      if (handleUnauthorized(response)) return;
      const data = await readJson<{
        user?: UserSummary;
        messages?: DirectMessage[];
        blockState?: BlockState;
        typing?: boolean;
        error?: string;
      }>(response);
      if (!response.ok) throw new Error(data.error ?? "Could not load messages");
      const incoming = [...(data.messages ?? [])].reverse().find((message) => message.senderId !== currentUser.id);
      if (quiet && incoming && previousIncomingId.current && incoming.id !== previousIncomingId.current) playBlink();
      previousIncomingId.current = incoming?.id ?? null;
      setDirectMessages(data.messages ?? []);
      setBlockState(data.blockState ?? { blocked: false, blockedByMe: false, blockedMe: false });
      setDirectTyping(Boolean(data.typing));
      if (data.user) {
        setSelected((current) => current?.type === "direct" && current.user.id === userId
          ? { type: "direct", user: data.user! }
          : current);
      }
      if (!quiet) setError("");
      void loadOverview(true);
    } catch (loadError) {
      if (!quiet) setError(loadError instanceof Error ? loadError.message : "Could not load messages");
    } finally {
      if (!quiet) setLoadingChat(false);
    }
  }, [currentUser.id, handleUnauthorized, loadOverview, playBlink]);

  const loadGroup = useCallback(async (groupId: string, quiet = false) => {
    if (quiet && document.visibilityState !== "visible") return;
    if (!quiet) setLoadingChat(true);
    try {
      const response = await fetch(`/api/groups/${groupId}`, { cache: "no-store" });
      if (handleUnauthorized(response)) return;
      const data = await readJson<{
        group?: { id: string; name: string; role: "OWNER" | "MEMBER"; members: GroupMember[] };
        messages?: GroupMessage[];
        typingUsers?: string[];
        error?: string;
      }>(response);
      if (!response.ok) throw new Error(data.error ?? "Could not load group");
      const incoming = [...(data.messages ?? [])].reverse().find((message) => message.senderId !== currentUser.id);
      if (quiet && incoming && previousIncomingId.current && incoming.id !== previousIncomingId.current) playBlink();
      previousIncomingId.current = incoming?.id ?? null;
      setGroupMessages(data.messages ?? []);
      setGroupMembers(data.group?.members ?? []);
      setGroupTypingUsers(data.typingUsers ?? []);
      if (data.group) {
        setSelected((current) => current?.type === "group" && current.group.id === groupId
          ? {
              type: "group",
              group: {
                ...current.group,
                name: data.group!.name,
                role: data.group!.role,
                memberCount: data.group!.members.length
              }
            }
          : current);
      }
      if (!quiet) setError("");
      void loadOverview(true);
    } catch (loadError) {
      if (!quiet) setError(loadError instanceof Error ? loadError.message : "Could not load group");
    } finally {
      if (!quiet) setLoadingChat(false);
    }
  }, [currentUser.id, handleUnauthorized, loadOverview, playBlink]);

  useEffect(() => {
    audioRef.current = new Audio("/sounds/blink.wav");
    audioRef.current.preload = "auto";
    const primeAudio = () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.volume = 0;
      void audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
      }).catch(() => {
        audio.volume = 1;
      });
    };
    window.addEventListener("pointerdown", primeAudio, { once: true });
    void loadOverview();
    const overviewInterval = window.setInterval(() => void loadOverview(true), 5_000);
    const heartbeat = () => {
      if (document.visibilityState === "visible") {
        void fetch("/api/presence", { method: "POST" });
      }
    };
    heartbeat();
    const heartbeatInterval = window.setInterval(heartbeat, 20_000);

    const markOffline = () => {
      if (document.visibilityState === "hidden") {
        void fetch("/api/presence", { method: "DELETE", keepalive: true });
      } else {
        heartbeat();
      }
    };
    document.addEventListener("visibilitychange", markOffline);

    return () => {
      window.clearInterval(overviewInterval);
      window.clearInterval(heartbeatInterval);
      document.removeEventListener("visibilitychange", markOffline);
      window.removeEventListener("pointerdown", primeAudio);
    };
  }, [loadOverview]);

  useEffect(() => {
    if (!selected) return;
    previousIncomingId.current = null;
    setMessageText("");
    setMenuOpen(false);
    const id = selected.type === "direct" ? selected.user.id : selected.group.id;
    const loader = selected.type === "direct" ? loadDirect : loadGroup;
    void loader(id);
    const interval = window.setInterval(() => void loader(id, true), 2_500);
    return () => window.clearInterval(interval);
  }, [selected?.type, selected?.type === "direct" ? selected.user.id : selected?.group.id, loadDirect, loadGroup]);

  useEffect(() => {
    if (!initialUrlHandledRef.current && !loadingOverview) {
      const params = new URLSearchParams(window.location.search);
      const directId = params.get("direct");
      const groupId = params.get("group");
      if (params.get("tab") === "invites") setTab("invites");
      if (directId) {
        const known = conversations.find((conversation) => conversation.user.id === directId)?.user;
        setSelected({ type: "direct", user: known ?? { id: directId, username: "loading" } });
      } else if (groupId) {
        const known = groups.find((group) => group.id === groupId);
        if (known) setSelected({ type: "group", group: known });
      }
      initialUrlHandledRef.current = true;
    }
  }, [conversations, groups, loadingOverview]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || tab !== "chats") {
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`, { cache: "no-store", signal: controller.signal });
        const data = await readJson<{ users?: UserSummary[] }>(response);
        if (response.ok) setSearchResults(data.users ?? []);
      } catch {
        setSearchResults([]);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, tab]);

  useEffect(() => {
    const trimmed = inviteQuery.trim();
    if (trimmed.length < 2 || !inviteModalOpen) {
      setInviteResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`, { cache: "no-store", signal: controller.signal });
        const data = await readJson<{ users?: UserSummary[] }>(response);
        if (response.ok) setInviteResults((data.users ?? []).filter((user) => !groupMembers.some((member) => member.id === user.id)));
      } catch {
        setInviteResults([]);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [inviteModalOpen, inviteQuery, groupMembers]);

  useEffect(() => {
    const allMessages = selected?.type === "direct" ? directMessages : groupMessages;
    if (allMessages.length > 0) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [directMessages.length, groupMessages.length, selected?.type]);

  useEffect(() => {
    async function checkNotifications() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setNotificationState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setNotificationState("blocked");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setNotificationState(subscription ? "enabled" : "disabled");
    }
    void checkNotifications().catch(() => setNotificationState("error"));

    const receivePush = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "BLINK_PUSH") {
        playBlink();
        void loadOverview(true);
        const active = selectedRef.current;
        if (active?.type === "direct") void loadDirect(active.user.id, true);
        if (active?.type === "group") void loadGroup(active.group.id, true);
      }
    };
    navigator.serviceWorker?.addEventListener("message", receivePush);
    return () => navigator.serviceWorker?.removeEventListener("message", receivePush);
  }, [loadDirect, loadGroup, loadOverview, playBlink]);

  const selectDirect = useCallback((user: UserSummary) => {
    previousIncomingId.current = null;
    setDirectMessages([]);
    setSelected({ type: "direct", user });
    setQuery("");
    setSearchResults([]);
    window.history.replaceState(null, "", `/chat?direct=${user.id}`);
  }, []);

  const selectGroup = useCallback((group: GroupSummary) => {
    previousIncomingId.current = null;
    setGroupMessages([]);
    setSelected({ type: "group", group });
    window.history.replaceState(null, "", `/chat?group=${group.id}`);
  }, []);

  const closeChat = useCallback(() => {
    setSelected(null);
    setDirectMessages([]);
    setGroupMessages([]);
    window.history.replaceState(null, "", "/chat");
  }, []);

  async function signalTyping(isTyping: boolean) {
    if (!selected) return;
    const targetId = selected.type === "direct" ? selected.user.id : selected.group.id;
    await fetch("/api/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopeType: selected.type, targetId, isTyping })
    }).catch(() => undefined);
  }

  function handleMessageChange(value: string) {
    setMessageText(value.slice(0, 1000));
    if (!selected || !value.trim()) {
      void signalTyping(false);
      return;
    }
    const now = Date.now();
    if (now - typingSentAtRef.current > 1_800) {
      typingSentAtRef.current = now;
      void signalTyping(true);
    }
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => void signalTyping(false), 2_500);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !messageText.trim() || sending) return;
    if (selected.type === "direct" && blockState.blocked) return;
    const body = messageText.trim();
    setMessageText("");
    setSending(true);
    setError("");
    void signalTyping(false);

    try {
      const endpoint = selected.type === "direct"
        ? `/api/messages/${selected.user.id}`
        : `/api/groups/${selected.group.id}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });
      if (handleUnauthorized(response)) return;
      const data = await readJson<{ message?: DirectMessage | GroupMessage; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Could not send message");
      if (selected.type === "direct") setDirectMessages((current) => [...current, data.message as DirectMessage]);
      else setGroupMessages((current) => [...current, data.message as GroupMessage]);
      void loadOverview(true);
    } catch (sendError) {
      setMessageText(body);
      setError(sendError instanceof Error ? sendError.message : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupName.trim() || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName })
      });
      const data = await readJson<{ group?: { id: string; name: string; createdAt: string }; error?: string }>(response);
      if (!response.ok || !data.group) throw new Error(data.error ?? "Could not create group");
      setCreateGroupOpen(false);
      setGroupName("");
      await loadOverview(true);
      setTab("groups");
      selectGroup({
        id: data.group.id,
        name: data.group.name,
        role: "OWNER",
        memberCount: 1,
        unreadCount: 0,
        lastMessage: "No messages yet",
        lastMessageAt: data.group.createdAt,
        lastSender: null
      });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create group");
    } finally {
      setCreatingGroup(false);
    }
  }

  async function inviteUser(user: UserSummary) {
    if (selected?.type !== "group") return;
    const response = await fetch(`/api/groups/${selected.group.id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id })
    });
    const data = await readJson<{ error?: string }>(response);
    if (!response.ok) {
      setError(data.error ?? "Could not send invitation");
      return;
    }
    setInviteQuery("");
    setInviteResults([]);
    setInviteModalOpen(false);
  }

  async function respondToInvite(invite: GroupInvite, action: "accept" | "decline") {
    const response = await fetch(`/api/groups/invites/${invite.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const data = await readJson<{ joined?: boolean; groupId?: string; error?: string }>(response);
    if (!response.ok) {
      setError(data.error ?? "Could not respond to invitation");
      return;
    }
    await loadOverview(true);
    if (data.joined && data.groupId) {
      const group = groups.find((item) => item.id === data.groupId) ?? {
        id: data.groupId,
        name: invite.group.name,
        role: "MEMBER" as const,
        memberCount: 1,
        unreadCount: 0,
        lastMessage: "No messages yet",
        lastMessageAt: new Date().toISOString(),
        lastSender: null
      };
      setTab("groups");
      selectGroup(group);
    }
  }

  async function toggleBlock() {
    if (selected?.type !== "direct") return;
    const shouldBlock = !blockState.blockedByMe;
    if (shouldBlock && !window.confirm(`Block @${selected.user.username}? Neither of you will be able to send direct messages.`)) return;
    const response = await fetch(`/api/blocks/${selected.user.id}`, { method: shouldBlock ? "POST" : "DELETE" });
    const data = await readJson<{ error?: string }>(response);
    if (!response.ok) {
      setError(data.error ?? "Could not update block");
      return;
    }
    setMenuOpen(false);
    await loadDirect(selected.user.id, true);
    await loadOverview(true);
  }

  async function deleteDirectHistory() {
    if (selected?.type !== "direct") return;
    if (!window.confirm(`Delete the entire chat with @${selected.user.username} for both people? This cannot be undone.`)) return;
    const response = await fetch(`/api/messages/${selected.user.id}`, { method: "DELETE" });
    const data = await readJson<{ error?: string }>(response);
    if (!response.ok) {
      setError(data.error ?? "Could not delete chat history");
      return;
    }
    setMenuOpen(false);
    setDirectMessages([]);
    await loadOverview(true);
  }

  async function clearGroupHistory() {
    if (selected?.type !== "group") return;
    if (!window.confirm(`Delete all messages in ${selected.group.name} for every member? This cannot be undone.`)) return;
    const response = await fetch(`/api/groups/${selected.group.id}/history`, { method: "DELETE" });
    const data = await readJson<{ error?: string }>(response);
    if (!response.ok) {
      setError(data.error ?? "Could not clear group history");
      return;
    }
    setMenuOpen(false);
    setGroupMessages([]);
    await loadOverview(true);
  }

  async function leaveGroup() {
    if (selected?.type !== "group") return;
    if (!window.confirm(`Leave ${selected.group.name}?`)) return;
    const response = await fetch(`/api/groups/${selected.group.id}/leave`, { method: "POST" });
    const data = await readJson<{ error?: string }>(response);
    if (!response.ok) {
      setError(data.error ?? "Could not leave group");
      return;
    }
    setMenuOpen(false);
    closeChat();
    await loadOverview(true);
  }

  async function enableNotifications() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setNotificationState("unsupported");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotificationState(permission === "denied" ? "blocked" : "disabled");
        return;
      }
      const configResponse = await fetch("/api/push/subscribe", { cache: "no-store" });
      const config = await readJson<{ configured?: boolean; publicKey?: string | null; error?: string }>(configResponse);
      if (!configResponse.ok || !config.configured || !config.publicKey) {
        throw new Error(config.error ?? "Push notification keys are not configured in Vercel");
      }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey) as BufferSource
        });
      }
      const saveResponse = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON())
      });
      const saveData = await readJson<{ error?: string }>(saveResponse);
      if (!saveResponse.ok) throw new Error(saveData.error ?? "Could not save notification subscription");
      setNotificationState("enabled");
      playBlink();
    } catch (notificationError) {
      setNotificationState("error");
      setError(notificationError instanceof Error ? notificationError.message : "Could not enable notifications");
    }
  }

  async function disableNotifications() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }
      setNotificationState("disabled");
    } catch {
      setNotificationState("error");
    }
  }

  async function deleteAccount() {
    setDeletingAccount(true);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true })
      });
      const data = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Could not delete account");
      router.replace("/");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete account");
      setDeletingAccount(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  const directStatus = selected?.type === "direct"
    ? selected.user.online ? "online" : formatLastSeen(selected.user.lastSeenAt)
    : "";
  const typingText = selected?.type === "direct"
    ? directTyping ? "typing…" : directStatus
    : groupTypingUsers.length === 1
      ? `@${groupTypingUsers[0]} is typing…`
      : groupTypingUsers.length > 1
        ? `${groupTypingUsers.length} people are typing…`
        : selected?.type === "group" ? `${selected.group.memberCount} members` : "";

  const chatMessages = selected?.type === "direct" ? directMessages : groupMessages;
  const canSend = selected?.type === "direct" ? !blockState.blocked : Boolean(selected);
  const searchList = query.trim().length >= 2 ? searchResults : [];
  const notificationsLabel = useMemo(() => ({
    checking: "Checking notifications…",
    unsupported: "Notifications are not supported here",
    disabled: "Enable notifications",
    blocked: "Notifications are blocked in browser settings",
    enabled: "Notifications enabled",
    error: "Notification setup needs attention"
  })[notificationState], [notificationState]);

  return (
    <main className="h-dvh overflow-hidden p-0 md:p-4 lg:p-6">
      <div className="glass mx-auto flex h-full max-w-7xl overflow-hidden md:rounded-[2rem]">
        <aside className={`${selected ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-white/10 md:w-[380px] md:border-r`}>
          <div className="safe-top border-b border-white/10 px-4 pb-3 pt-4 md:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#8cffaa] font-black text-[#07110d]">B</div>
                <div className="min-w-0">
                  <div className="font-semibold">Blink</div>
                  <div className="truncate text-xs text-white/35">@{currentUser.username}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={enableNotifications} aria-label={notificationsLabel} title={notificationsLabel} className="rounded-xl p-2.5 text-white/50 hover:bg-white/5 hover:text-white">
                  {notificationState === "enabled" ? <BellRing size={18} className="text-[#8cffaa]" /> : <Bell size={18} />}
                </button>
                <button type="button" onClick={() => setCreateGroupOpen(true)} aria-label="Create group" className="rounded-xl p-2.5 text-white/50 hover:bg-white/5 hover:text-white">
                  <Plus size={19} />
                </button>
                <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings" className="rounded-xl p-2.5 text-white/50 hover:bg-white/5 hover:text-white">
                  <Settings size={18} />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-black/20 p-1 text-xs">
              {(["chats", "groups", "invites"] as SidebarTab[]).map((item) => (
                <button key={item} type="button" onClick={() => { setTab(item); setQuery(""); }} className={`relative rounded-xl px-2 py-2.5 capitalize transition ${tab === item ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}>
                  {item}
                  {item === "invites" && invites.length > 0 && <span className="absolute right-2 top-1.5 grid min-w-4 place-items-center rounded-full bg-[#8cffaa] px-1 text-[9px] font-bold text-[#07110d]">{invites.length}</span>}
                </button>
              ))}
            </div>

            {tab === "chats" && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3.5 focus-within:border-[#8cffaa]/40">
                <Search size={17} className="text-white/35" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a username" autoCapitalize="none" spellCheck={false} className="min-w-0 flex-1 bg-transparent py-3 text-[16px] outline-none placeholder:text-white/25" />
                {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-white/35 hover:text-white"><X size={16} /></button>}
              </div>
            )}
          </div>

          <div className="soft-scrollbar flex-1 overflow-y-auto p-3">
            {loadingOverview ? (
              <div className="grid h-40 place-items-center text-white/35"><LoaderCircle size={22} className="animate-spin" /></div>
            ) : tab === "chats" ? (
              searchList.length > 0 ? (
                <div className="space-y-1">
                  {searchList.map((user) => (
                    <button key={user.id} type="button" onClick={() => selectDirect(user)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/5">
                      <div className="relative"><InitialBadge label={user.username} small /><span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[#0d1b15]"><PresenceDot online={user.online} /></span></div>
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">@{user.username}</div><div className="mt-0.5 text-xs text-white/35">{user.online ? "online" : formatLastSeen(user.lastSeenAt)}</div></div>
                    </button>
                  ))}
                </div>
              ) : conversations.length > 0 && query.trim().length < 2 ? (
                <div className="space-y-1">
                  {conversations.map((conversation) => (
                    <button key={conversation.user.id} type="button" onClick={() => selectDirect(conversation.user)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${selected?.type === "direct" && selected.user.id === conversation.user.id ? "bg-[#8cffaa]/10" : "hover:bg-white/5"}`}>
                      <div className="relative"><InitialBadge label={conversation.user.username} small /><span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[#0d1b15]"><PresenceDot online={conversation.user.online} /></span></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3"><div className="truncate text-sm font-medium">@{conversation.user.username}</div><div className="shrink-0 text-[10px] text-white/30">{formatConversationTime(conversation.lastMessageAt)}</div></div>
                        <div className="mt-1 flex items-center gap-2"><p className={`min-w-0 flex-1 truncate text-xs ${conversation.unreadCount ? "text-white/80" : "text-white/35"}`}>{conversation.sentByMe ? "You: " : ""}{conversation.lastMessage}</p>{conversation.unreadCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-[#8cffaa] px-1.5 py-0.5 text-[10px] font-bold text-[#07110d]">{conversation.unreadCount}</span>}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<MessageCircle size={21} />} title={query.trim().length >= 2 ? "No users found" : "No chats yet"} text={query.trim().length >= 2 ? "Try another username." : "Search for someone to start a private text chat."} />
              )
            ) : tab === "groups" ? (
              groups.length > 0 ? (
                <div className="space-y-1">
                  {groups.map((group) => (
                    <button key={group.id} type="button" onClick={() => selectGroup(group)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${selected?.type === "group" && selected.group.id === group.id ? "bg-sky-300/10" : "hover:bg-white/5"}`}>
                      <InitialBadge label={group.name} small group />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3"><div className="truncate text-sm font-medium">{group.name}</div><div className="shrink-0 text-[10px] text-white/30">{formatConversationTime(group.lastMessageAt)}</div></div>
                        <div className="mt-1 flex items-center gap-2"><p className={`min-w-0 flex-1 truncate text-xs ${group.unreadCount ? "text-white/80" : "text-white/35"}`}>{group.lastSender ? `@${group.lastSender}: ` : ""}{group.lastMessage}</p>{group.unreadCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-sky-200 px-1.5 py-0.5 text-[10px] font-bold text-[#07110d]">{group.unreadCount}</span>}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : <EmptyState icon={<Users size={21} />} title="No groups yet" text="Create a group, then invite people by username." action={<button type="button" onClick={() => setCreateGroupOpen(true)} className="mt-4 rounded-xl bg-[#8cffaa] px-4 py-2.5 text-xs font-semibold text-[#07110d]">Create group</button>} />
            ) : invites.length > 0 ? (
              <div className="space-y-3">
                {invites.map((invite) => (
                  <div key={invite.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-center gap-3"><InitialBadge label={invite.group.name} small group /><div className="min-w-0"><div className="truncate text-sm font-medium">{invite.group.name}</div><div className="mt-0.5 text-xs text-white/35">Invited by @{invite.inviterUsername}</div></div></div>
                    <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => void respondToInvite(invite, "decline")} className="rounded-xl border border-white/10 px-3 py-2.5 text-xs text-white/60 hover:bg-white/5">Decline</button><button type="button" onClick={() => void respondToInvite(invite, "accept")} className="rounded-xl bg-[#8cffaa] px-3 py-2.5 text-xs font-semibold text-[#07110d]">Join</button></div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={<UserPlus size={21} />} title="No invitations" text="Group invitations will appear here." />}
          </div>

          <div className="safe-bottom border-t border-white/10 px-5 pt-3 text-center text-[11px] leading-5 text-white/25">Seen messages disappear 24 hours later.</div>
        </aside>

        <section className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
          {selected ? (
            <>
              <header className="safe-top relative flex items-center gap-3 border-b border-white/10 px-3 pb-3 pt-3 md:px-5 md:pb-4 md:pt-4">
                <button type="button" onClick={closeChat} aria-label="Back" className="rounded-xl p-2 text-white/60 hover:bg-white/5 hover:text-white md:hidden"><ArrowLeft size={21} /></button>
                {selected.type === "direct" ? (
                  <div className="relative"><InitialBadge label={selected.user.username} small /><span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[#0d1b15]"><PresenceDot online={selected.user.online} /></span></div>
                ) : <InitialBadge label={selected.group.name} small group />}
                <button type="button" onClick={() => selected.type === "group" && setMembersModalOpen(true)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-semibold">{selected.type === "direct" ? `@${selected.user.username}` : selected.group.name}</div>
                  <div className={`mt-0.5 truncate text-[11px] ${typingText.includes("typing") ? "text-[#8cffaa]" : "text-white/35"}`}>{typingText}</div>
                </button>
                <button type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Conversation options" className="rounded-xl p-2.5 text-white/55 hover:bg-white/5 hover:text-white"><MoreVertical size={19} /></button>
                {menuOpen && (
                  <div className="absolute right-3 top-[calc(100%-4px)] z-30 w-60 rounded-2xl border border-white/10 bg-[#102019] p-1.5 shadow-2xl">
                    {selected.type === "direct" ? (
                      <>
                        <button type="button" onClick={() => void toggleBlock()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/70 hover:bg-white/5"><Ban size={16} />{blockState.blockedByMe ? "Unblock user" : "Block user"}</button>
                        <button type="button" onClick={() => void deleteDirectHistory()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-red-200 hover:bg-red-400/10"><Trash2 size={16} />Delete chat for both</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => { setMenuOpen(false); setInviteModalOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/70 hover:bg-white/5"><UserPlus size={16} />Invite user</button>
                        <button type="button" onClick={() => { setMenuOpen(false); setMembersModalOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/70 hover:bg-white/5"><Users size={16} />View members</button>
                        {selected.group.role === "OWNER" && <button type="button" onClick={() => void clearGroupHistory()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-red-200 hover:bg-red-400/10"><History size={16} />Clear group history</button>}
                        <button type="button" onClick={() => void leaveGroup()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-red-200 hover:bg-red-400/10"><DoorOpen size={16} />Leave group</button>
                      </>
                    )}
                  </div>
                )}
              </header>

              <div className="soft-scrollbar flex-1 overflow-y-auto px-3 py-5 sm:px-5 md:px-8">
                {loadingChat ? (
                  <div className="grid h-full min-h-48 place-items-center text-white/35"><LoaderCircle size={23} className="animate-spin" /></div>
                ) : chatMessages.length === 0 ? (
                  <div className="grid h-full min-h-48 place-items-center text-center"><div><InitialBadge label={selected.type === "direct" ? selected.user.username : selected.group.name} group={selected.type === "group"} /><p className="mt-4 text-sm font-medium">Start with a simple hello.</p><p className="mt-1 text-xs text-white/35">Text only. Seen messages disappear after 24 hours.</p></div></div>
                ) : (
                  <div className="mx-auto flex max-w-3xl flex-col gap-2.5">
                    {selected.type === "direct" ? directMessages.map((message) => {
                      const sentByMe = message.senderId === currentUser.id;
                      return <MessageBubble key={message.id} body={message.body} createdAt={message.createdAt} sentByMe={sentByMe} label={sentByMe ? undefined : selected.user.username} seen={Boolean(message.seenAt)} />;
                    }) : groupMessages.map((message) => {
                      const sentByMe = message.senderId === currentUser.id;
                      return <MessageBubble key={message.id} body={message.body} createdAt={message.createdAt} sentByMe={sentByMe} label={sentByMe ? undefined : message.senderUsername} seen={message.seenByAll} />;
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {selected.type === "direct" && blockState.blocked && (
                <div className="mx-3 mb-2 rounded-xl border border-amber-300/15 bg-amber-300/10 px-3 py-2.5 text-center text-xs text-amber-100 md:mx-5">
                  {blockState.blockedByMe ? "You blocked this user. Unblock them to send messages." : "This user blocked you. Direct messages are disabled."}
                </div>
              )}
              {error && <div className="mx-3 mb-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-center text-xs text-red-200 md:mx-5">{error}</div>}

              <form onSubmit={sendMessage} className="safe-bottom border-t border-white/10 p-3 pt-3 md:p-4">
                <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[1.5rem] border border-white/10 bg-black/20 p-1.5 pl-4 focus-within:border-[#8cffaa]/40">
                  <textarea value={messageText} onChange={(event) => handleMessageChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={canSend ? "Write a message..." : "Messaging is blocked"} disabled={!canSend} rows={1} className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 text-[16px] leading-6 outline-none placeholder:text-white/25 disabled:cursor-not-allowed" />
                  <button type="submit" disabled={!messageText.trim() || sending || !canSend} aria-label="Send message" className="grid size-11 shrink-0 place-items-center rounded-[1.15rem] bg-[#8cffaa] text-[#07110d] transition hover:bg-[#a8ffbd] disabled:cursor-not-allowed disabled:opacity-30">{sending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}</button>
                </div>
              </form>
            </>
          ) : (
            <div className="grid h-full place-items-center p-8 text-center"><div><div className="mx-auto grid size-16 place-items-center rounded-[1.5rem] border border-[#8cffaa]/15 bg-[#8cffaa]/5 text-[#8cffaa]"><MessageCircle size={26} /></div><h2 className="mt-5 text-lg font-semibold">Text, groups and quiet notifications</h2><p className="mt-2 max-w-sm text-sm leading-6 text-white/35">Choose a conversation, create a group, or search for a username.</p></div></div>
          )}
        </section>
      </div>

      {createGroupOpen && <Modal title="Create a group" onClose={() => setCreateGroupOpen(false)}><form onSubmit={createGroup}><label className="text-xs text-white/45">Group name</label><input autoFocus value={groupName} onChange={(event) => setGroupName(event.target.value.slice(0, 40))} placeholder="Weekend plans" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-[16px] outline-none focus:border-[#8cffaa]/40" /><button type="submit" disabled={!groupName.trim() || creatingGroup} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#8cffaa] px-4 py-3.5 text-sm font-semibold text-[#07110d] disabled:opacity-40">{creatingGroup && <LoaderCircle size={17} className="animate-spin" />}Create group</button></form></Modal>}

      {inviteModalOpen && selected?.type === "group" && <Modal title={`Invite to ${selected.group.name}`} onClose={() => setInviteModalOpen(false)}><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3.5"><Search size={17} className="text-white/35" /><input autoFocus value={inviteQuery} onChange={(event) => setInviteQuery(event.target.value)} placeholder="Search username" className="min-w-0 flex-1 bg-transparent py-3.5 text-[16px] outline-none" /></div><div className="mt-3 max-h-72 overflow-y-auto">{inviteResults.map((user) => <button key={user.id} type="button" onClick={() => void inviteUser(user)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/5"><InitialBadge label={user.username} small /><div className="min-w-0 flex-1"><div className="truncate text-sm">@{user.username}</div><div className="text-xs text-white/35">{user.online ? "online" : formatLastSeen(user.lastSeenAt)}</div></div><UserPlus size={17} className="text-[#8cffaa]" /></button>)}{inviteQuery.trim().length >= 2 && inviteResults.length === 0 && <p className="py-10 text-center text-sm text-white/35">No available users found.</p>}</div></Modal>}

      {membersModalOpen && selected?.type === "group" && <Modal title={`${selected.group.name} members`} onClose={() => setMembersModalOpen(false)}><div className="max-h-[60vh] space-y-1 overflow-y-auto">{groupMembers.map((member) => <div key={member.id} className="flex items-center gap-3 rounded-2xl px-3 py-3"><div className="relative"><InitialBadge label={member.username} small /><span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[#0d1b15]"><PresenceDot online={member.online} /></span></div><div className="min-w-0 flex-1"><div className="truncate text-sm">@{member.username}{member.id === currentUser.id ? " · you" : ""}</div><div className="mt-0.5 text-xs text-white/35">{member.online ? "online" : formatLastSeen(member.lastSeenAt)}</div></div>{member.role === "OWNER" && <span className="rounded-full border border-[#8cffaa]/20 bg-[#8cffaa]/10 px-2 py-1 text-[10px] text-[#b9ffc9]">Owner</span>}</div>)}</div></Modal>}

      {settingsOpen && <Modal title="Settings" onClose={() => setSettingsOpen(false)}><div className="space-y-2"><button type="button" onClick={notificationState === "enabled" ? disableNotifications : enableNotifications} disabled={notificationState === "unsupported" || notificationState === "blocked"} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-4 text-left disabled:opacity-50">{notificationState === "enabled" ? <BellRing size={19} className="text-[#8cffaa]" /> : <Bell size={19} className="text-white/55" />}<div className="min-w-0 flex-1"><div className="text-sm font-medium">{notificationsLabel}</div><div className="mt-1 text-xs leading-5 text-white/35">The “blink” sound plays while the app is open. Background push uses the phone’s system sound.</div></div></button><button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 px-4 py-4 text-left text-white/70 hover:bg-white/5"><LogOut size={19} /><span className="text-sm">Sign out</span></button><button type="button" onClick={() => { setSettingsOpen(false); setDeleteAccountOpen(true); }} className="flex w-full items-center gap-3 rounded-2xl border border-red-400/15 bg-red-400/[0.06] px-4 py-4 text-left text-red-200"><Trash2 size={19} /><div><div className="text-sm font-medium">Delete account</div><div className="mt-1 text-xs text-red-200/55">Permanently removes your account and messages.</div></div></button></div></Modal>}

      {deleteAccountOpen && <Modal title="Delete your account" onClose={() => !deletingAccount && setDeleteAccountOpen(false)}><p className="text-sm leading-6 text-white/65">Are you sure you want to delete your account?</p><p className="mt-2 text-xs leading-5 text-white/35">This cannot be undone. Your direct messages, memberships, subscriptions and account will be removed.</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" disabled={deletingAccount} onClick={() => setDeleteAccountOpen(false)} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/65">No, keep it</button><button type="button" disabled={deletingAccount} onClick={() => void deleteAccount()} className="flex items-center justify-center gap-2 rounded-2xl bg-red-400 px-4 py-3 text-sm font-semibold text-[#220707] disabled:opacity-50">{deletingAccount && <LoaderCircle size={16} className="animate-spin" />}Yes, delete</button></div></Modal>}
    </main>
  );
}

function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="px-5 py-16 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/5 text-white/35">{icon}</div><p className="mt-4 text-sm font-medium text-white/70">{title}</p><p className="mt-1 text-xs leading-5 text-white/35">{text}</p>{action}</div>;
}

function MessageBubble({ body, createdAt, sentByMe, label, seen }: { body: string; createdAt: string; sentByMe: boolean; label?: string; seen: boolean }) {
  return (
    <div className={`flex ${sentByMe ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[86%] sm:max-w-[72%] ${sentByMe ? "items-end" : "items-start"}`}>
        {label && <div className="mb-1 px-2 text-[10px] font-medium text-[#8cffaa]/70">@{label}</div>}
        <div className={`whitespace-pre-wrap break-words rounded-[1.35rem] px-4 py-2.5 text-[15px] leading-6 ${sentByMe ? "rounded-br-md bg-[#8cffaa] text-[#07110d]" : "rounded-bl-md border border-white/10 bg-white/[0.06] text-white"}`}>{body}</div>
        <div className={`mt-1 flex items-center gap-1 px-1 text-[10px] text-white/25 ${sentByMe ? "justify-end" : "justify-start"}`}><span>{formatTime(createdAt)}</span>{sentByMe && (seen ? <CheckCheck size={12} className="text-[#8cffaa]/70" /> : <Check size={12} />)}</div>
      </div>
    </div>
  );
}
