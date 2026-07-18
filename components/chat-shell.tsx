"use client";

import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  LoaderCircle,
  LogOut,
  MessageCircle,
  Search,
  Send,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

interface UserSummary {
  id: string;
  username: string;
}

interface Conversation {
  user: UserSummary;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  sentByMe: boolean;
}

interface Message {
  id: string;
  body: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  seenAt: string | null;
  expiresAt: string | null;
}

interface ChatShellProps {
  currentUser: UserSummary;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
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

function InitialBadge({ username, small = false }: { username: string; small?: boolean }) {
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-2xl border border-[#8cffaa]/20 bg-[#8cffaa]/10 font-semibold uppercase text-[#b9ffc9] ${
        small ? "size-10 text-sm" : "size-12 text-base"
      }`}
    >
      {username.slice(0, 2)}
    </div>
  );
}

export function ChatShell({ currentUser }: ChatShellProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCount = useRef(0);

  const handleUnauthorized = useCallback((response: Response) => {
    if (response.status === 401) {
      router.replace("/");
      router.refresh();
      return true;
    }
    return false;
  }, [router]);

  const loadConversations = useCallback(async (quiet = false) => {
    if (!quiet) setLoadingConversations(true);

    try {
      const response = await fetch("/api/conversations", { cache: "no-store" });
      if (handleUnauthorized(response)) return;
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load chats");
      setConversations(data.conversations);
    } catch (loadError) {
      if (!quiet) {
        setError(loadError instanceof Error ? loadError.message : "Could not load chats");
      }
    } finally {
      if (!quiet) setLoadingConversations(false);
    }
  }, [handleUnauthorized]);

  const loadMessages = useCallback(async (user: UserSummary, quiet = false) => {
    if (!quiet) setLoadingMessages(true);

    try {
      const response = await fetch(`/api/messages/${user.id}`, { cache: "no-store" });
      if (handleUnauthorized(response)) return;
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load messages");
      setMessages(data.messages);
      setSelectedUser(data.user);
      setError("");
      void loadConversations(true);
    } catch (loadError) {
      if (!quiet) {
        setError(loadError instanceof Error ? loadError.message : "Could not load messages");
      }
    } finally {
      if (!quiet) setLoadingMessages(false);
    }
  }, [handleUnauthorized, loadConversations]);

  useEffect(() => {
    void loadConversations();
    const interval = window.setInterval(() => void loadConversations(true), 5000);
    return () => window.clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedUser) return;
    const activeUser = selectedUser;
    void loadMessages(activeUser);
    const interval = window.setInterval(() => void loadMessages(activeUser, true), 3000);
    return () => window.clearInterval(interval);
  }, [selectedUser?.id, loadMessages]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(trimmedQuery)}`, {
          cache: "no-store",
          signal: controller.signal
        });
        if (handleUnauthorized(response)) return;
        const data = await response.json();
        if (response.ok) setSearchResults(data.users);
      } catch (searchError) {
        if (!(searchError instanceof DOMException && searchError.name === "AbortError")) {
          setSearchResults([]);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, handleUnauthorized]);

  useEffect(() => {
    if (messages.length !== previousMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: previousMessageCount.current ? "smooth" : "auto" });
      previousMessageCount.current = messages.length;
    }
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser || !messageText.trim() || sending) return;

    const body = messageText.trim();
    setMessageText("");
    setSending(true);
    setError("");

    try {
      const response = await fetch(`/api/messages/${selectedUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });
      if (handleUnauthorized(response)) return;
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send message");
      setMessages((current) => [...current, data.message]);
      void loadConversations(true);
    } catch (sendError) {
      setMessageText(body);
      setError(sendError instanceof Error ? sendError.message : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  function selectUser(user: UserSummary) {
    previousMessageCount.current = 0;
    setMessages([]);
    setSelectedUser(user);
    setQuery("");
    setSearchResults([]);
  }

  const listItems = query.trim().length >= 2
    ? searchResults.map((user) => ({ type: "search" as const, user }))
    : conversations.map((conversation) => ({ type: "conversation" as const, conversation }));

  return (
    <main className="h-dvh overflow-hidden p-0 md:p-4 lg:p-6">
      <div className="glass mx-auto flex h-full max-w-7xl overflow-hidden md:rounded-[2rem]">
        <aside
          className={`${selectedUser ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-white/10 md:w-[360px] md:border-r`}
        >
          <div className="safe-top border-b border-white/10 px-4 pb-4 pt-4 md:px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-2xl bg-[#8cffaa] font-black text-[#07110d]">
                  B
                </div>
                <div>
                  <div className="font-semibold">Blink</div>
                  <div className="text-xs text-white/35">@{currentUser.username}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                aria-label="Sign out"
                className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut size={17} />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3.5 focus-within:border-[#8cffaa]/40">
              <Search size={17} className="text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a username"
                autoCapitalize="none"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent py-3 text-[16px] outline-none placeholder:text-white/25"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="text-white/35 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="soft-scrollbar flex-1 overflow-y-auto p-3">
            {loadingConversations && !query ? (
              <div className="grid h-40 place-items-center text-white/35">
                <LoaderCircle size={22} className="animate-spin" />
              </div>
            ) : listItems.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/5 text-white/35">
                  {query ? <Search size={21} /> : <MessageCircle size={21} />}
                </div>
                <p className="mt-4 text-sm font-medium text-white/70">
                  {query ? "No users found" : "No chats yet"}
                </p>
                <p className="mt-1 text-xs leading-5 text-white/35">
                  {query ? "Try another username." : "Search for someone to start a text chat."}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {listItems.map((item) => {
                  if (item.type === "search") {
                    return (
                      <button
                        key={item.user.id}
                        type="button"
                        onClick={() => selectUser(item.user)}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-white/5"
                      >
                        <InitialBadge username={item.user.username} small />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">@{item.user.username}</div>
                          <div className="mt-0.5 text-xs text-[#8cffaa]/60">Start a conversation</div>
                        </div>
                      </button>
                    );
                  }

                  const { conversation } = item;
                  const active = selectedUser?.id === conversation.user.id;
                  return (
                    <button
                      key={conversation.user.id}
                      type="button"
                      onClick={() => selectUser(conversation.user)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                        active ? "bg-[#8cffaa]/10" : "hover:bg-white/5"
                      }`}
                    >
                      <InitialBadge username={conversation.user.username} small />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-sm font-medium">@{conversation.user.username}</div>
                          <div className="shrink-0 text-[10px] text-white/30">
                            {formatConversationTime(conversation.lastMessageAt)}
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <p className={`min-w-0 flex-1 truncate text-xs ${conversation.unreadCount ? "text-white/80" : "text-white/35"}`}>
                            {conversation.sentByMe ? "You: " : ""}{conversation.lastMessage}
                          </p>
                          {conversation.unreadCount > 0 && (
                            <span className="grid min-w-5 place-items-center rounded-full bg-[#8cffaa] px-1.5 py-0.5 text-[10px] font-bold text-[#07110d]">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="safe-bottom border-t border-white/10 px-5 pt-3 text-center text-[11px] leading-5 text-white/25">
            Seen messages are deleted after 24 hours.
          </div>
        </aside>

        <section className={`${selectedUser ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
          {selectedUser ? (
            <>
              <header className="safe-top flex items-center gap-3 border-b border-white/10 px-3 pb-3 pt-3 md:px-5 md:pb-4 md:pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  aria-label="Back to chats"
                  className="rounded-xl p-2 text-white/60 hover:bg-white/5 hover:text-white md:hidden"
                >
                  <ArrowLeft size={21} />
                </button>
                <InitialBadge username={selectedUser.username} small />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">@{selectedUser.username}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/35">
                    <Clock3 size={11} />
                    deletes 24h after viewing
                  </div>
                </div>
              </header>

              <div className="soft-scrollbar flex-1 overflow-y-auto px-3 py-5 sm:px-5 md:px-8">
                {loadingMessages ? (
                  <div className="grid h-full min-h-48 place-items-center text-white/35">
                    <LoaderCircle size={23} className="animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="grid h-full min-h-48 place-items-center text-center">
                    <div>
                      <InitialBadge username={selectedUser.username} />
                      <p className="mt-4 text-sm font-medium">Start with a simple hello.</p>
                      <p className="mt-1 text-xs text-white/35">Text only. No photos, videos, or voice notes.</p>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-3xl flex-col gap-2.5">
                    {messages.map((message) => {
                      const sentByMe = message.senderId === currentUser.id;
                      return (
                        <div key={message.id} className={`flex ${sentByMe ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[84%] sm:max-w-[72%] ${sentByMe ? "items-end" : "items-start"}`}>
                            <div
                              className={`whitespace-pre-wrap break-words rounded-[1.35rem] px-4 py-2.5 text-[15px] leading-6 ${
                                sentByMe
                                  ? "rounded-br-md bg-[#8cffaa] text-[#07110d]"
                                  : "rounded-bl-md border border-white/10 bg-white/[0.06] text-white"
                              }`}
                            >
                              {message.body}
                            </div>
                            <div className={`mt-1 flex items-center gap-1 px-1 text-[10px] text-white/25 ${sentByMe ? "justify-end" : "justify-start"}`}>
                              <span>{formatTime(message.createdAt)}</span>
                              {sentByMe && (
                                message.seenAt
                                  ? <CheckCheck size={12} className="text-[#8cffaa]/70" />
                                  : <Check size={12} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {error && (
                <div className="mx-3 mb-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-center text-xs text-red-200 md:mx-5">
                  {error}
                </div>
              )}

              <form onSubmit={sendMessage} className="safe-bottom border-t border-white/10 p-3 pt-3 md:p-4">
                <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[1.5rem] border border-white/10 bg-black/20 p-1.5 pl-4 focus-within:border-[#8cffaa]/40">
                  <textarea
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value.slice(0, 1000))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder="Write a message..."
                    rows={1}
                    className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 text-[16px] leading-6 outline-none placeholder:text-white/25"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim() || sending}
                    aria-label="Send message"
                    className="grid size-11 shrink-0 place-items-center rounded-[1.15rem] bg-[#8cffaa] text-[#07110d] transition hover:bg-[#a8ffbd] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {sending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="grid h-full place-items-center p-8 text-center">
              <div>
                <div className="mx-auto grid size-16 place-items-center rounded-[1.5rem] border border-[#8cffaa]/15 bg-[#8cffaa]/5 text-[#8cffaa]">
                  <MessageCircle size={26} />
                </div>
                <h2 className="mt-5 text-lg font-semibold">Your quiet corner for text</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-white/35">
                  Choose a conversation or search for a username. Messages begin their 24-hour expiry after the recipient sees them.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
