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
  Moon,
  MoreVertical,
  Plus,
  Reply,
  Search,
  Send,
  Settings,
  Sun,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, PointerEvent as ReactPointerEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  replyTo: { id: string; body: string; senderId: string } | null;
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
  replyTo: { id: string; body: string; senderId: string; senderUsername: string } | null;
}

type SelectedChat =
  | { type: "direct"; user: UserSummary }
  | { type: "group"; group: GroupSummary };

type SidebarTab = "chats" | "groups" | "invites";
type ThemeMode = "dark" | "light";
type NotificationState = "checking" | "unsupported" | "disabled" | "blocked" | "enabled" | "error";

interface PushNotice {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

interface ReplyTarget {
  id: string;
  body: string;
  senderUsername: string;
}

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
        ? "border-group bg-group-soft text-group"
        : "border-accent bg-accent-soft text-accent"
    } ${small ? "size-10 text-sm" : "size-12 text-base"}`}>
      {group ? <Users size={small ? 17 : 20} /> : label.slice(0, 2)}
    </div>
  );
}

function PresenceDot({ online }: { online?: boolean }) {
  return <span className={`inline-block size-2 rounded-full ${online ? "bg-accent" : "bg-offline"}`} />;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-overlay p-0 backdrop-blur-sm sm:place-items-center sm:p-5" onMouseDown={onClose}>
      <div className="safe-bottom glass w-full max-w-md rounded-t-[2rem] border-theme p-5 sm:rounded-[2rem]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-muted hover-surface hover-text-main" aria-label="Close">
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

function subscriptionUsesKey(subscription: PushSubscription, publicKey: string) {
  const currentKey = subscription.options.applicationServerKey;
  if (!currentKey) return false;
  const expected = urlBase64ToUint8Array(publicKey);
  const current = new Uint8Array(currentKey);
  if (current.length !== expected.length) return false;
  return current.every((value, index) => value === expected[index]);
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
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("dark");
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
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [notificationState, setNotificationState] = useState<NotificationState>("checking");
  const [pushNotice, setPushNotice] = useState<PushNotice | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousIncomingId = useRef<string | null>(null);
  const selectedRef = useRef<SelectedChat | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingSentAtRef = useRef(0);
  const initialUrlHandledRef = useRef(false);
  const pushNoticeTimerRef = useRef<number | null>(null);
  const suppressNextIncomingSoundRef = useRef(false);

  selectedRef.current = selected;

  const applyTheme = useCallback((nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", nextTheme === "light" ? "#edf5ef" : "#07110d");
    window.localStorage.setItem("blink-theme", nextTheme);
  }, []);

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
      if (quiet && incoming && previousIncomingId.current && incoming.id !== previousIncomingId.current) {
        if (suppressNextIncomingSoundRef.current) suppressNextIncomingSoundRef.current = false;
        else playBlink();
      }
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
      if (quiet && incoming && previousIncomingId.current && incoming.id !== previousIncomingId.current) {
        if (suppressNextIncomingSoundRef.current) suppressNextIncomingSoundRef.current = false;
        else playBlink();
      }
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
    const savedTheme = window.localStorage.getItem("blink-theme");
    const initialTheme: ThemeMode = savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
    document.documentElement.style.colorScheme = initialTheme;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", initialTheme === "light" ? "#edf5ef" : "#07110d");
  }, []);

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
    void fetch("/api/auth/refresh", { method: "POST" });
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
      if (pushNoticeTimerRef.current) window.clearTimeout(pushNoticeTimerRef.current);
    };
  }, [loadOverview]);

  useEffect(() => {
    if (!selected) return;
    previousIncomingId.current = null;
    setMessageText("");
    setReplyTarget(null);
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
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setNotificationState("disabled");
        return;
      }

      const configResponse = await fetch("/api/push/subscribe", { cache: "no-store" });
      const config = await readJson<{ configured?: boolean; publicKey?: string | null }>(configResponse);
      if (!configResponse.ok || !config.configured || !config.publicKey) {
        setNotificationState("error");
        return;
      }

      // If the VAPID pair changed, replace the browser subscription with one
      // created from the current public key.
      if (!subscriptionUsesKey(subscription, config.publicKey)) {
        await subscription.unsubscribe();
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey) as BufferSource
        });
      }

      // Re-associate this device with the currently logged-in account. This
      // repairs notification delivery after logout/login and server redeploys.
      const saveResponse = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON())
      });
      setNotificationState(saveResponse.ok ? "enabled" : "error");
    }
    void checkNotifications().catch(() => setNotificationState("error"));

    const receivePush = (event: MessageEvent<{ type?: string; payload?: PushNotice }>) => {
      if (event.data?.type === "BLINK_PUSH") {
        const payload = event.data.payload ?? {
          title: "Blink",
          body: "You received a new message",
          url: "/chat"
        };
        setPushNotice(payload);
        if (pushNoticeTimerRef.current) window.clearTimeout(pushNoticeTimerRef.current);
        pushNoticeTimerRef.current = window.setTimeout(() => setPushNotice(null), 5_000);
        playBlink();
        void loadOverview(true);
        const active = selectedRef.current;
        if (active?.type === "direct") {
          suppressNextIncomingSoundRef.current = true;
          void loadDirect(active.user.id, true);
        }
        if (active?.type === "group") {
          suppressNextIncomingSoundRef.current = true;
          void loadGroup(active.group.id, true);
        }
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
    const activeReply = replyTarget;
    setMessageText("");
    setReplyTarget(null);
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
        body: JSON.stringify({ body, replyToId: activeReply?.id ?? null })
      });
      if (handleUnauthorized(response)) return;
      const data = await readJson<{ message?: DirectMessage | GroupMessage; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Could not send message");
      if (selected.type === "direct") setDirectMessages((current) => [...current, data.message as DirectMessage]);
      else setGroupMessages((current) => [...current, data.message as GroupMessage]);
      void loadOverview(true);
    } catch (sendError) {
      setMessageText(body);
      setReplyTarget(activeReply);
      setError(sendError instanceof Error ? sendError.message : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  function startReply(message: DirectMessage | GroupMessage, senderUsername: string) {
    setReplyTarget({
      id: message.id,
      body: message.body,
      senderUsername
    });
    window.setTimeout(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>("textarea[data-message-composer='true']");
      textarea?.focus();
    }, 0);
  }

  async function deleteSingleMessage(messageId: string) {
    if (!selected || deletingMessageId) return;
    if (!window.confirm("Delete this message for everyone? This cannot be undone.")) return;

    setDeletingMessageId(messageId);
    setError("");
    try {
      const endpoint = selected.type === "direct"
        ? `/api/messages/${selected.user.id}/${messageId}`
        : `/api/groups/${selected.group.id}/messages/${messageId}`;
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = await readJson<{ error?: string }>(response);
      if (handleUnauthorized(response)) return;
      if (!response.ok) throw new Error(data.error ?? "Could not delete message");

      if (selected.type === "direct") {
        setDirectMessages((current) => current.filter((message) => message.id !== messageId));
      } else {
        setGroupMessages((current) => current.filter((message) => message.id !== messageId));
      }
      if (replyTarget?.id === messageId) setReplyTarget(null);
      void loadOverview(true);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete message");
    } finally {
      setDeletingMessageId(null);
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

  async function removeGroupMember(member: GroupMember) {
    if (selected?.type !== "group" || selected.group.role !== "OWNER") return;
    if (!window.confirm(`Remove @${member.username} from ${selected.group.name}? They will immediately lose access to the group.`)) return;

    setRemovingMemberId(member.id);
    try {
      const response = await fetch(`/api/groups/${selected.group.id}/members/${member.id}`, { method: "DELETE" });
      const data = await readJson<{ memberCount?: number; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Could not remove member");
      setGroupMembers((current) => current.filter((item) => item.id !== member.id));
      setSelected((current) => current?.type === "group" && current.group.id === selected.group.id
        ? { type: "group", group: { ...current.group, memberCount: data.memberCount ?? Math.max(1, current.group.memberCount - 1) } }
        : current);
      await loadOverview(true);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove member");
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function deleteGroup() {
    if (selected?.type !== "group" || selected.group.role !== "OWNER" || deletingGroup) return;
    if (!window.confirm(`Permanently delete ${selected.group.name}? All messages, invitations and memberships will be deleted for everyone. This cannot be undone.`)) return;

    setDeletingGroup(true);
    try {
      const response = await fetch(`/api/groups/${selected.group.id}`, { method: "DELETE" });
      const data = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Could not delete group");
      setMenuOpen(false);
      setMembersModalOpen(false);
      closeChat();
      await loadOverview(true);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete group");
    } finally {
      setDeletingGroup(false);
    }
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
      if (subscription && !subscriptionUsesKey(subscription, config.publicKey)) {
        await subscription.unsubscribe();
        subscription = null;
      }
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
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint })
          });
        }
      }
    } catch {
      // Logging out must still work if notification cleanup fails.
    }
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
      {pushNotice && (
        <button
          type="button"
          onClick={() => {
            const url = pushNotice.url;
            setPushNotice(null);
            window.location.assign(url);
          }}
          className="safe-top fixed left-3 right-3 top-3 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-accent bg-panel-solid px-4 py-3 text-left shadow-2xl backdrop-blur-xl md:left-auto md:right-6 md:top-6 md:w-[380px]"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-on-accent"><BellRing size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{pushNotice.title}</span>
            <span className="mt-0.5 block truncate text-xs text-muted">{pushNotice.body}</span>
          </span>
          <X size={16} className="shrink-0 text-muted" />
        </button>
      )}
      <div className="glass mx-auto flex h-full max-w-7xl overflow-hidden md:rounded-[2rem]">
        <aside className={`${selected ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-theme md:w-[380px] md:border-r`}>
          <div className="safe-top border-b border-theme px-4 pb-3 pt-4 md:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent font-black text-on-accent">B</div>
                <div className="min-w-0">
                  <div className="font-semibold">Blink</div>
                  <div className="truncate text-xs text-muted">@{currentUser.username}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={enableNotifications} aria-label={notificationsLabel} title={notificationsLabel} className="rounded-xl p-2.5 text-muted hover-surface hover-text-main">
                  {notificationState === "enabled" ? <BellRing size={18} className="text-accent" /> : <Bell size={18} />}
                </button>
                <button type="button" onClick={() => setCreateGroupOpen(true)} aria-label="Create group" className="rounded-xl p-2.5 text-muted hover-surface hover-text-main">
                  <Plus size={19} />
                </button>
                <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings" className="rounded-xl p-2.5 text-muted hover-surface hover-text-main">
                  <Settings size={18} />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-theme bg-input p-1 text-xs">
              {(["chats", "groups", "invites"] as SidebarTab[]).map((item) => (
                <button key={item} type="button" onClick={() => { setTab(item); setQuery(""); }} className={`relative rounded-xl px-2 py-2.5 capitalize transition ${tab === item ? "bg-selected text-main" : "text-muted hover-text-secondary"}`}>
                  {item}
                  {item === "invites" && invites.length > 0 && <span className="absolute right-2 top-1.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-on-accent">{invites.length}</span>}
                </button>
              ))}
            </div>

            {(notificationState === "disabled" || notificationState === "error") && (
              <button type="button" onClick={enableNotifications} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-accent bg-accent-soft px-3.5 py-3 text-left">
                <BellRing size={17} className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-accent">Enable message notifications</span><span className="mt-0.5 block text-[10px] leading-4 text-muted">Receive alerts when Blink is in the background or closed.</span></span>
              </button>
            )}
            {notificationState === "blocked" && (
              <div className="mt-3 rounded-2xl border border-warning bg-warning-soft px-3.5 py-3 text-[11px] leading-5 text-warning">Notifications are blocked. Allow them in your browser or phone settings.</div>
            )}

            {tab === "chats" && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-theme bg-input px-3.5 focus-accent">
                <Search size={17} className="text-muted" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a username" autoCapitalize="none" spellCheck={false} className="min-w-0 flex-1 bg-transparent py-3 text-[16px] outline-none placeholder-faint" />
                {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-muted hover-text-main"><X size={16} /></button>}
              </div>
            )}
          </div>

          <div className="soft-scrollbar flex-1 overflow-y-auto p-3">
            {loadingOverview ? (
              <div className="grid h-40 place-items-center text-muted"><LoaderCircle size={22} className="animate-spin" /></div>
            ) : tab === "chats" ? (
              searchList.length > 0 ? (
                <div className="space-y-1">
                  {searchList.map((user) => (
                    <button key={user.id} type="button" onClick={() => selectDirect(user)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover-surface">
                      <div className="relative"><InitialBadge label={user.username} small /><span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-panel"><PresenceDot online={user.online} /></span></div>
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">@{user.username}</div><div className="mt-0.5 text-xs text-muted">{user.online ? "online" : formatLastSeen(user.lastSeenAt)}</div></div>
                    </button>
                  ))}
                </div>
              ) : conversations.length > 0 && query.trim().length < 2 ? (
                <div className="space-y-1">
                  {conversations.map((conversation) => (
                    <button key={conversation.user.id} type="button" onClick={() => selectDirect(conversation.user)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${selected?.type === "direct" && selected.user.id === conversation.user.id ? "bg-accent-soft" : "hover-surface"}`}>
                      <div className="relative"><InitialBadge label={conversation.user.username} small /><span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-panel"><PresenceDot online={conversation.user.online} /></span></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3"><div className="truncate text-sm font-medium">@{conversation.user.username}</div><div className="shrink-0 text-[10px] text-faint">{formatConversationTime(conversation.lastMessageAt)}</div></div>
                        <div className="mt-1 flex items-center gap-2"><p className={`min-w-0 flex-1 truncate text-xs ${conversation.unreadCount ? "text-secondary" : "text-muted"}`}>{conversation.sentByMe ? "You: " : ""}{conversation.lastMessage}</p>{conversation.unreadCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-on-accent">{conversation.unreadCount}</span>}</div>
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
                    <button key={group.id} type="button" onClick={() => selectGroup(group)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${selected?.type === "group" && selected.group.id === group.id ? "bg-group-soft" : "hover-surface"}`}>
                      <InitialBadge label={group.name} small group />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3"><div className="truncate text-sm font-medium">{group.name}</div><div className="shrink-0 text-[10px] text-faint">{formatConversationTime(group.lastMessageAt)}</div></div>
                        <div className="mt-1 flex items-center gap-2"><p className={`min-w-0 flex-1 truncate text-xs ${group.unreadCount ? "text-secondary" : "text-muted"}`}>{group.lastSender ? `@${group.lastSender}: ` : ""}{group.lastMessage}</p>{group.unreadCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-group px-1.5 py-0.5 text-[10px] font-bold text-on-accent">{group.unreadCount}</span>}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : <EmptyState icon={<Users size={21} />} title="No groups yet" text="Create a group, then invite people by username." action={<button type="button" onClick={() => setCreateGroupOpen(true)} className="mt-4 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-on-accent">Create group</button>} />
            ) : invites.length > 0 ? (
              <div className="space-y-3">
                {invites.map((invite) => (
                  <div key={invite.id} className="rounded-2xl border border-theme bg-subtle p-4">
                    <div className="flex items-center gap-3"><InitialBadge label={invite.group.name} small group /><div className="min-w-0"><div className="truncate text-sm font-medium">{invite.group.name}</div><div className="mt-0.5 text-xs text-muted">Invited by @{invite.inviterUsername}</div></div></div>
                    <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => void respondToInvite(invite, "decline")} className="rounded-xl border border-theme px-3 py-2.5 text-xs text-secondary hover-surface">Decline</button><button type="button" onClick={() => void respondToInvite(invite, "accept")} className="rounded-xl bg-accent px-3 py-2.5 text-xs font-semibold text-on-accent">Join</button></div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={<UserPlus size={21} />} title="No invitations" text="Group invitations will appear here." />}
          </div>

          <div className="safe-bottom border-t border-theme px-5 pt-3 text-center text-[11px] leading-5 text-faint">Seen messages disappear 24 hours later.</div>
        </aside>

        <section className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
          {selected ? (
            <>
              <header className="safe-top relative flex items-center gap-3 border-b border-theme px-3 pb-3 pt-3 md:px-5 md:pb-4 md:pt-4">
                <button type="button" onClick={closeChat} aria-label="Back" className="rounded-xl p-2 text-secondary hover-surface hover-text-main md:hidden"><ArrowLeft size={21} /></button>
                {selected.type === "direct" ? (
                  <div className="relative"><InitialBadge label={selected.user.username} small /><span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-panel"><PresenceDot online={selected.user.online} /></span></div>
                ) : <InitialBadge label={selected.group.name} small group />}
                <button type="button" onClick={() => selected.type === "group" && setMembersModalOpen(true)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-semibold">{selected.type === "direct" ? `@${selected.user.username}` : selected.group.name}</div>
                  <div className={`mt-0.5 truncate text-[11px] ${typingText.includes("typing") ? "text-accent" : "text-muted"}`}>{typingText}</div>
                </button>
                <button type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Conversation options" className="rounded-xl p-2.5 text-muted hover-surface hover-text-main"><MoreVertical size={19} /></button>
                {menuOpen && (
                  <div className="absolute right-3 top-[calc(100%-4px)] z-30 w-60 rounded-2xl border border-theme bg-panel-solid p-1.5 shadow-2xl">
                    {selected.type === "direct" ? (
                      <>
                        <button type="button" onClick={() => void toggleBlock()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-secondary hover-surface"><Ban size={16} />{blockState.blockedByMe ? "Unblock user" : "Block user"}</button>
                        <button type="button" onClick={() => void deleteDirectHistory()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-danger hover-danger-soft"><Trash2 size={16} />Delete chat for both</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => { setMenuOpen(false); setInviteModalOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-secondary hover-surface"><UserPlus size={16} />Invite user</button>
                        <button type="button" onClick={() => { setMenuOpen(false); setMembersModalOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-secondary hover-surface"><Users size={16} />View members</button>
                        {selected.group.role === "OWNER" && <button type="button" onClick={() => void clearGroupHistory()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-danger hover-danger-soft"><History size={16} />Clear group history</button>}
                        {selected.group.role === "OWNER" && <button type="button" disabled={deletingGroup} onClick={() => void deleteGroup()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-danger hover-danger-soft disabled:opacity-50"><Trash2 size={16} />{deletingGroup ? "Deleting group…" : "Delete group"}</button>}
                        <button type="button" onClick={() => void leaveGroup()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-danger hover-danger-soft"><DoorOpen size={16} />Leave group</button>
                      </>
                    )}
                  </div>
                )}
              </header>

              <div className="soft-scrollbar flex-1 overflow-y-auto px-3 py-5 sm:px-5 md:px-8">
                {loadingChat ? (
                  <div className="grid h-full min-h-48 place-items-center text-muted"><LoaderCircle size={23} className="animate-spin" /></div>
                ) : chatMessages.length === 0 ? (
                  <div className="grid h-full min-h-48 place-items-center text-center"><div><InitialBadge label={selected.type === "direct" ? selected.user.username : selected.group.name} group={selected.type === "group"} /><p className="mt-4 text-sm font-medium">Start with a simple hello.</p><p className="mt-1 text-xs text-muted">Text only. Seen messages disappear after 24 hours.</p></div></div>
                ) : (
                  <div className="mx-auto flex max-w-3xl flex-col gap-2.5">
                    {selected.type === "direct" ? directMessages.map((message) => {
                      const sentByMe = message.senderId === currentUser.id;
                      const senderUsername = sentByMe ? currentUser.username : selected.user.username;
                      const replySender = message.replyTo
                        ? message.replyTo.senderId === currentUser.id ? currentUser.username : selected.user.username
                        : undefined;
                      return (
                        <MessageBubble
                          key={message.id}
                          body={message.body}
                          createdAt={message.createdAt}
                          sentByMe={sentByMe}
                          label={sentByMe ? undefined : selected.user.username}
                          seen={Boolean(message.seenAt)}
                          replyTo={message.replyTo ? { body: message.replyTo.body, senderUsername: replySender! } : null}
                          onReply={() => startReply(message, senderUsername)}
                          onDelete={sentByMe ? () => void deleteSingleMessage(message.id) : undefined}
                          deleting={deletingMessageId === message.id}
                        />
                      );
                    }) : groupMessages.map((message) => {
                      const sentByMe = message.senderId === currentUser.id;
                      return (
                        <MessageBubble
                          key={message.id}
                          body={message.body}
                          createdAt={message.createdAt}
                          sentByMe={sentByMe}
                          label={sentByMe ? undefined : message.senderUsername}
                          seen={message.seenByAll}
                          replyTo={message.replyTo ? { body: message.replyTo.body, senderUsername: message.replyTo.senderUsername } : null}
                          onReply={() => startReply(message, message.senderUsername)}
                          onDelete={sentByMe ? () => void deleteSingleMessage(message.id) : undefined}
                          deleting={deletingMessageId === message.id}
                        />
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {selected.type === "direct" && blockState.blocked && (
                <div className="mx-3 mb-2 rounded-xl border border-warning bg-warning-soft px-3 py-2.5 text-center text-xs text-warning md:mx-5">
                  {blockState.blockedByMe ? "You blocked this user. Unblock them to send messages." : "This user blocked you. Direct messages are disabled."}
                </div>
              )}
              {error && <div className="mx-3 mb-2 rounded-xl border border-danger bg-danger-soft px-3 py-2 text-center text-xs text-danger md:mx-5">{error}</div>}

              <form onSubmit={sendMessage} className="safe-bottom border-t border-theme p-3 pt-3 md:p-4">
                <div className="mx-auto max-w-3xl">
                  {replyTarget && (
                    <div className="mb-2 flex items-center gap-3 rounded-2xl border border-accent bg-accent-soft px-3.5 py-2.5">
                      <Reply size={16} className="shrink-0 text-accent" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-medium text-accent">Replying to @{replyTarget.senderUsername}</div>
                        <div className="mt-0.5 truncate text-xs text-muted">{replyTarget.body}</div>
                      </div>
                      <button type="button" onClick={() => setReplyTarget(null)} aria-label="Cancel reply" className="rounded-lg p-1.5 text-muted hover-surface hover-text-main"><X size={15} /></button>
                    </div>
                  )}
                  <div className="flex items-end gap-2 rounded-[1.5rem] border border-theme bg-input p-1.5 pl-4 focus-accent">
                    <textarea data-message-composer="true" value={messageText} onChange={(event) => handleMessageChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={canSend ? "Write a message..." : "Messaging is blocked"} disabled={!canSend} rows={1} className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 text-[16px] leading-6 outline-none placeholder-faint disabled:cursor-not-allowed" />
                    <button type="submit" disabled={!messageText.trim() || sending || !canSend} aria-label="Send message" className="grid size-11 shrink-0 place-items-center rounded-[1.15rem] bg-accent text-on-accent transition hover-accent disabled:cursor-not-allowed disabled:opacity-30">{sending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}</button>
                  </div>
                </div>
              </form>
            </>
          ) : (
            <div className="grid h-full place-items-center p-8 text-center"><div><div className="mx-auto grid size-16 place-items-center rounded-[1.5rem] border border-accent bg-accent-soft text-accent"><MessageCircle size={26} /></div><h2 className="mt-5 text-lg font-semibold">Text, groups and quiet notifications</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted">Choose a conversation, create a group, or search for a username.</p></div></div>
          )}
        </section>
      </div>

      {createGroupOpen && <Modal title="Create a group" onClose={() => setCreateGroupOpen(false)}><form onSubmit={createGroup}><label className="text-xs text-muted">Group name</label><input autoFocus value={groupName} onChange={(event) => setGroupName(event.target.value.slice(0, 40))} placeholder="Weekend plans" className="mt-2 w-full rounded-2xl border border-theme bg-input px-4 py-3.5 text-[16px] outline-none focus-border-accent" /><button type="submit" disabled={!groupName.trim() || creatingGroup} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 text-sm font-semibold text-on-accent disabled:opacity-40">{creatingGroup && <LoaderCircle size={17} className="animate-spin" />}Create group</button></form></Modal>}

      {inviteModalOpen && selected?.type === "group" && <Modal title={`Invite to ${selected.group.name}`} onClose={() => setInviteModalOpen(false)}><div className="flex items-center gap-3 rounded-2xl border border-theme bg-input px-3.5"><Search size={17} className="text-muted" /><input autoFocus value={inviteQuery} onChange={(event) => setInviteQuery(event.target.value)} placeholder="Search username" className="min-w-0 flex-1 bg-transparent py-3.5 text-[16px] outline-none" /></div><div className="mt-3 max-h-72 overflow-y-auto">{inviteResults.map((user) => <button key={user.id} type="button" onClick={() => void inviteUser(user)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover-surface"><InitialBadge label={user.username} small /><div className="min-w-0 flex-1"><div className="truncate text-sm">@{user.username}</div><div className="text-xs text-muted">{user.online ? "online" : formatLastSeen(user.lastSeenAt)}</div></div><UserPlus size={17} className="text-accent" /></button>)}{inviteQuery.trim().length >= 2 && inviteResults.length === 0 && <p className="py-10 text-center text-sm text-muted">No available users found.</p>}</div></Modal>}

      {membersModalOpen && selected?.type === "group" && <Modal title={`${selected.group.name} members`} onClose={() => setMembersModalOpen(false)}><div className="max-h-[60vh] space-y-1 overflow-y-auto">{groupMembers.map((member) => <div key={member.id} className="flex items-center gap-3 rounded-2xl px-3 py-3"><div className="relative"><InitialBadge label={member.username} small /><span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-panel"><PresenceDot online={member.online} /></span></div><div className="min-w-0 flex-1"><div className="truncate text-sm">@{member.username}{member.id === currentUser.id ? " · you" : ""}</div><div className="mt-0.5 text-xs text-muted">{member.online ? "online" : formatLastSeen(member.lastSeenAt)}</div></div>{member.role === "OWNER" ? <span className="rounded-full border border-accent bg-accent-soft px-2 py-1 text-[10px] text-accent">Owner</span> : selected.group.role === "OWNER" && member.id !== currentUser.id ? <button type="button" disabled={removingMemberId === member.id} onClick={() => void removeGroupMember(member)} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-danger bg-danger-soft px-2.5 py-2 text-[11px] text-danger disabled:opacity-50"><UserMinus size={14} />{removingMemberId === member.id ? "Removing…" : "Remove"}</button> : null}</div>)}</div>{selected.group.role === "OWNER" && <p className="mt-4 text-xs leading-5 text-faint">Only the group owner can remove members or delete the group.</p>}</Modal>}

      {settingsOpen && (
        <Modal title="Settings" onClose={() => setSettingsOpen(false)}>
          <div className="space-y-2">
            <div className="rounded-2xl border border-theme bg-subtle p-4">
              <div className="flex items-center gap-3">
                {theme === "dark" ? <Moon size={19} className="text-accent" /> : <Sun size={19} className="text-warning" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Appearance</div>
                  <div className="mt-1 text-xs text-muted">Choose a light or dark theme on this device.</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-theme bg-input p-1">
                <button type="button" onClick={() => applyTheme("light")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs transition ${theme === "light" ? "bg-accent font-semibold text-on-accent" : "text-muted hover-surface"}`}><Sun size={15} />Light</button>
                <button type="button" onClick={() => applyTheme("dark")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs transition ${theme === "dark" ? "bg-accent font-semibold text-on-accent" : "text-muted hover-surface"}`}><Moon size={15} />Dark</button>
              </div>
            </div>
            <button type="button" onClick={notificationState === "enabled" ? disableNotifications : enableNotifications} disabled={notificationState === "unsupported" || notificationState === "blocked"} className="flex w-full items-center gap-3 rounded-2xl border border-theme bg-subtle px-4 py-4 text-left disabled:opacity-50">
              {notificationState === "enabled" ? <BellRing size={19} className="text-accent" /> : <Bell size={19} className="text-muted" />}
              <div className="min-w-0 flex-1"><div className="text-sm font-medium">{notificationsLabel}</div><div className="mt-1 text-xs leading-5 text-muted">The “blink” sound and an in-app alert play while Blink is open. In the background or when closed, the phone shows a push notification with its system notification sound.</div></div>
            </button>
            <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-2xl border border-theme px-4 py-4 text-left text-secondary hover-surface"><LogOut size={19} /><div><div className="text-sm">Sign out</div><div className="mt-1 text-xs text-muted">You stay signed in on this device until you choose this option.</div></div></button>
            <button type="button" onClick={() => { setSettingsOpen(false); setDeleteAccountOpen(true); }} className="flex w-full items-center gap-3 rounded-2xl border border-danger bg-danger-soft px-4 py-4 text-left text-danger"><Trash2 size={19} /><div><div className="text-sm font-medium">Delete account</div><div className="mt-1 text-xs text-danger-muted">Permanently removes your account and messages.</div></div></button>
          </div>
        </Modal>
      )}

      {deleteAccountOpen && <Modal title="Delete your account" onClose={() => !deletingAccount && setDeleteAccountOpen(false)}><p className="text-sm leading-6 text-secondary">Are you sure you want to delete your account?</p><p className="mt-2 text-xs leading-5 text-muted">This cannot be undone. Your direct messages, memberships, subscriptions and account will be removed.</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" disabled={deletingAccount} onClick={() => setDeleteAccountOpen(false)} className="rounded-2xl border border-theme px-4 py-3 text-sm text-secondary">No, keep it</button><button type="button" disabled={deletingAccount} onClick={() => void deleteAccount()} className="flex items-center justify-center gap-2 rounded-2xl bg-danger px-4 py-3 text-sm font-semibold text-on-danger disabled:opacity-50">{deletingAccount && <LoaderCircle size={16} className="animate-spin" />}Yes, delete</button></div></Modal>}
    </main>
  );
}

function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="px-5 py-16 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-subtle text-muted">{icon}</div><p className="mt-4 text-sm font-medium text-secondary">{title}</p><p className="mt-1 text-xs leading-5 text-muted">{text}</p>{action}</div>;
}

function MessageBubble({
  body,
  createdAt,
  sentByMe,
  label,
  seen,
  replyTo,
  onReply,
  onDelete,
  deleting
}: {
  body: string;
  createdAt: string;
  sentByMe: boolean;
  label?: string;
  seen: boolean;
  replyTo: { body: string; senderUsername: string } | null;
  onReply: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const horizontalSwipe = useRef(false);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    startPoint.current = { x: event.clientX, y: event.clientY };
    horizontalSwipe.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!startPoint.current) return;
    const deltaX = event.clientX - startPoint.current.x;
    const deltaY = event.clientY - startPoint.current.y;
    if (!horizontalSwipe.current && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
      startPoint.current = null;
      setDragX(0);
      return;
    }
    if (deltaX > 0) {
      horizontalSwipe.current = true;
      setDragX(Math.min(76, deltaX * 0.8));
    }
  }

  function finishSwipe() {
    if (dragX >= 52) onReply();
    startPoint.current = null;
    horizontalSwipe.current = false;
    setDragX(0);
  }

  return (
    <div className={`relative flex ${sentByMe ? "justify-end" : "justify-start"}`}>
      <div className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-accent transition-opacity" style={{ opacity: Math.min(1, dragX / 45) }}>
        <span className="grid size-8 place-items-center rounded-full border border-accent bg-accent-soft"><Reply size={15} /></span>
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishSwipe}
        onPointerCancel={finishSwipe}
        className={`max-w-[86%] touch-pan-y select-none sm:max-w-[72%] ${sentByMe ? "items-end" : "items-start"}`}
        style={{ transform: `translateX(${dragX}px)`, transition: startPoint.current ? "none" : "transform 160ms ease" }}
      >
        {label && <div className="mb-1 px-2 text-[10px] font-medium text-accent">@{label}</div>}
        <div className={`overflow-hidden rounded-[1.35rem] ${sentByMe ? "rounded-br-md bg-accent text-on-accent" : "rounded-bl-md border border-theme bg-subtle text-main"}`}>
          {replyTo && (
            <div className={`mx-2 mt-2 rounded-xl border-l-2 px-3 py-2 text-xs ${sentByMe ? "border-on-accent bg-input" : "border-accent bg-input"}`}>
              <div className={`text-[10px] font-semibold ${sentByMe ? "text-on-accent-strong" : "text-accent"}`}>@{replyTo.senderUsername}</div>
              <div className={`mt-0.5 line-clamp-2 ${sentByMe ? "text-on-accent-muted" : "text-muted"}`}>{replyTo.body}</div>
            </div>
          )}
          <div className="whitespace-pre-wrap break-words px-4 py-2.5 text-[15px] leading-6">{body}</div>
        </div>
        <div className={`mt-1 flex items-center gap-1.5 px-1 text-[10px] text-faint ${sentByMe ? "justify-end" : "justify-start"}`}>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onReply} className="rounded-md p-1 text-faint hover-surface hover-text-secondary" aria-label="Reply to message"><Reply size={12} /></button>
          <span>{formatTime(createdAt)}</span>
          {sentByMe && (seen ? <CheckCheck size={12} className="text-accent" /> : <Check size={12} />)}
          {onDelete && (
            <button type="button" disabled={deleting} onPointerDown={(event) => event.stopPropagation()} onClick={onDelete} className="rounded-md p-1 text-faint hover-danger-soft hover-text-danger disabled:opacity-40" aria-label="Delete message">
              {deleting ? <LoaderCircle size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
