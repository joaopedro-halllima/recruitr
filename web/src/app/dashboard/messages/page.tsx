"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import AppShell from "@/components/layout/AppShell";
import SideNav from "@/components/layout/SideNav";
import {
  createDmUploadSession,
  createDmThread,
  getDmMessages,
  getDmThreads,
  getMe,
  getNotifications,
  searchDmAthletes,
  sendDmMessage,
  uploadFileWithProgress,
  type DmAthleteSearchItem,
  type DmMessage,
  type DmThread,
  type MeUser,
} from "@/lib/api";
import { clearAuth, getStoredUser, getToken, setAuth } from "@/lib/auth";

type AttachmentDraft = {
  localId: string;
  kind: "image" | "video" | "document";
  publicUrl: string;
  mediaAssetId?: number;
  progress?: number;
  filename?: string;
};

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function MessagesPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [threads, setThreads] = useState<DmThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [composer, setComposer] = useState("");
  const [composerAttachments, setComposerAttachments] = useState<AttachmentDraft[]>([]);
  const [sending, setSending] = useState(false);
  const [showThreadListMobile, setShowThreadListMobile] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DmAthleteSearchItem[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<DmAthleteSearchItem | null>(null);
  const [initialMessage, setInitialMessage] = useState("");
  const [initialAttachments, setInitialAttachments] = useState<AttachmentDraft[]>([]);
  const [creatingThread, setCreatingThread] = useState(false);

  const activeThread = useMemo(
    () => threads.find((t) => t.threadId === activeThreadId) ?? null,
    [threads, activeThreadId]
  );
  const canStartNewOutreach = Boolean(
    user?.roles?.includes("coach") && user?.coach_profile?.is_verified_coach
  );
  const composerHasPendingUploads = composerAttachments.some((a) => !a.mediaAssetId);

  useEffect(() => {
    const tokenValue = getToken();
    const cached = getStoredUser<MeUser>();
    if (!tokenValue) {
      router.replace("/");
      return;
    }
    setToken(tokenValue);
    if (cached) setUser(cached);

    (async () => {
      try {
        const me = await getMe(tokenValue);
        setUser(me);
        setAuth(tokenValue, me);
      } catch (e) {
        clearAuth();
        setError(e instanceof Error ? e.message : "Failed to load /me");
        setTimeout(() => router.replace("/"), 800);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [router]);

  const refreshMeta = useCallback(
    async (tokenValue: string) => {
      const notif = await getNotifications(tokenValue, { limit: 1 });
      setUnreadCount(notif.unreadCount);
    },
    []
  );

  const refreshThreads = useCallback(
    async (tokenValue: string) => {
      setThreadsLoading(true);
      try {
        const data = await getDmThreads(tokenValue, 80);
        setThreads(data.items);
        if (!activeThreadId && data.items[0]) {
          setActiveThreadId(data.items[0].threadId);
        }
        if (activeThreadId && !data.items.some((t) => t.threadId === activeThreadId)) {
          setActiveThreadId(data.items[0]?.threadId ?? null);
        }
      } finally {
        setThreadsLoading(false);
      }
    },
    [activeThreadId]
  );

  const refreshMessages = useCallback(
    async (tokenValue: string, threadId: string) => {
      setMessagesLoading(true);
      try {
        const data = await getDmMessages(tokenValue, threadId, { limit: 120 });
        setMessages(data.items);
      } finally {
        setMessagesLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!token) return;
    void refreshMeta(token);
    void refreshThreads(token);

    const intervalId = window.setInterval(() => {
      void refreshMeta(token);
      void refreshThreads(token);
      if (activeThreadId) void refreshMessages(token, activeThreadId);
    }, 12000);
    return () => window.clearInterval(intervalId);
  }, [token, activeThreadId, refreshMeta, refreshMessages, refreshThreads]);

  useEffect(() => {
    if (!token || !activeThreadId) return;
    void refreshMessages(token, activeThreadId);
  }, [token, activeThreadId, refreshMessages]);

  useEffect(() => {
    if (!token) return;
    if (!canStartNewOutreach) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    let alive = true;
    const timeoutId = window.setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchDmAthletes(token, query, 12);
        if (alive) setSearchResults(data.items);
      } catch {
        if (alive) setSearchResults([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 220);

    return () => {
      alive = false;
      window.clearTimeout(timeoutId);
    };
  }, [token, searchQuery, canStartNewOutreach]);

  async function handleSend() {
    if (!token || !activeThreadId) return;
    const body = composer.trim();
    if (!body) return;
    setSending(true);
    try {
      const mediaAssetIds = composerAttachments
        .map((a) => a.mediaAssetId)
        .filter((id): id is number => typeof id === "number");
      await sendDmMessage(token, activeThreadId, body, mediaAssetIds);
      setComposer("");
      setComposerAttachments([]);
      await refreshThreads(token);
      await refreshMessages(token, activeThreadId);
    } finally {
      setSending(false);
    }
  }

  async function handleCreateThread() {
    if (!token || !selectedAthlete) return;
    const body = initialMessage.trim();
    if (!body) return;
    setCreatingThread(true);
    try {
      if (selectedAthlete.existingThreadId) {
        setActiveThreadId(selectedAthlete.existingThreadId);
        setShowThreadListMobile(false);
        await refreshMessages(token, selectedAthlete.existingThreadId);
      } else {
        const mediaAssetIds = initialAttachments
          .map((a) => a.mediaAssetId)
          .filter((id): id is number => typeof id === "number");
        const data = await createDmThread(token, selectedAthlete.userId, body, mediaAssetIds);
        await refreshThreads(token);
        setActiveThreadId(data.threadId);
        setShowThreadListMobile(false);
        await refreshMessages(token, data.threadId);
      }
      setInitialMessage("");
      setInitialAttachments([]);
      setSearchQuery("");
      setSearchResults([]);
      setSelectedAthlete(null);
    } finally {
      setCreatingThread(false);
    }
  }

  async function uploadAttachmentFile(
    file: File,
    target: "initial" | "composer"
  ) {
    if (!token) return;
    const guessedKind: "image" | "video" | "document" =
      file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "document";
    const localId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: AttachmentDraft = {
      localId,
      kind: guessedKind,
      publicUrl: "",
      mediaAssetId: undefined as number | undefined,
      progress: 0,
      filename: file.name,
    };

    const setList =
      target === "initial" ? setInitialAttachments : setComposerAttachments;

    setList((prev) => [...prev, item]);

    try {
      const session = await createDmUploadSession(token, file, guessedKind);
      const uploaded = await uploadFileWithProgress(token, session.uploadUrl, file, (pct) => {
        setList((prev) =>
          prev.map((a) => (a.localId === localId ? { ...a, progress: pct } : a))
        );
      });
      setList((prev) =>
        prev.map((a) =>
          a.localId === localId
            ? {
                ...a,
                progress: 100,
                mediaAssetId: uploaded.mediaAssetId,
                publicUrl: uploaded.publicUrl,
              }
            : a
        )
      );
    } catch {
      setList((prev) => prev.filter((a) => a.localId !== localId));
    }
  }

  if (authLoading) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 p-10 text-[var(--app-text)]">
        <div className="mx-auto max-w-3xl">Loading inbox…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="theme-content min-h-screen bg-neutral-950 p-10 text-[var(--app-text)]">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          {error}
        </div>
      </div>
    );
  }

  if (!user || !token) return null;

  return (
    <AppShell
      userEmail={user.email}
      unreadCount={unreadCount}
      onLogout={() => {
        clearAuth();
        router.push("/");
      }}
      left={<SideNav />}
      right={
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Inbox Actions</div>
            <div className="mt-3 space-y-2">
              <button
                onClick={() => {
                  void refreshThreads(token);
                  if (activeThreadId) void refreshMessages(token, activeThreadId);
                }}
                className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/10"
              >
                Refresh Inbox
              </button>
              <Link
                href="/dashboard/notifications"
                className="block w-full rounded-lg border border-white/10 px-3 py-2 text-center text-xs hover:bg-white/10"
              >
                Notifications
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Start New Message</div>
            <div className="mt-2 text-xs text-neutral-500">Search athletes by name/email</div>
            {!canStartNewOutreach ? (
              <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                Only verified coaches can start new outreach conversations.
              </div>
            ) : null}

            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={!canStartNewOutreach}
              className="mt-3 w-full rounded-xl border border-white/10 bg-neutral-950/30 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 disabled:opacity-60"
              placeholder="Search athletes..."
            />

            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {searching ? (
                <div className="text-xs text-neutral-500">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="text-xs text-neutral-500">Type at least 2 characters.</div>
              ) : (
                searchResults.map((a) => (
                  <button
                    key={a.userId}
                    onClick={() => setSelectedAthlete(a)}
                    className={`w-full rounded-lg border px-3 py-2 text-left ${
                      selectedAthlete?.userId === a.userId
                        ? "border-cyan-400/40 bg-cyan-400/10"
                        : "border-white/10 bg-neutral-950/30 hover:bg-white/10"
                    }`}
                  >
                    <div className="text-xs font-medium">{a.name}</div>
                    <div className="text-[11px] text-neutral-500">{a.meta || a.email}</div>
                    {a.existingThreadId ? (
                      <div className="text-[10px] text-emerald-300">Existing thread</div>
                    ) : null}
                  </button>
                ))
              )}
            </div>

            <textarea
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              disabled={!canStartNewOutreach || !selectedAthlete}
              className="mt-3 min-h-[72px] w-full resize-none rounded-xl border border-white/10 bg-neutral-950/30 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 disabled:opacity-60"
              placeholder={selectedAthlete ? "Write first message…" : "Select an athlete first"}
            />
            {initialAttachments.length > 0 ? (
              <div className="mt-2 space-y-1">
                {initialAttachments.map((att, idx) => (
                  <div
                    key={att.localId}
                    className="flex items-center justify-between rounded-md border border-white/10 bg-neutral-950/30 px-2 py-1"
                  >
                    <div className="truncate text-[11px] text-neutral-300">
                      [{att.kind}] {att.filename || att.publicUrl}{" "}
                      {typeof att.progress === "number" && att.progress < 100 ? `(${att.progress}%)` : ""}
                    </div>
                    <button
                      onClick={() =>
                        setInitialAttachments((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="ml-2 rounded border border-white/10 px-1 text-[10px] hover:bg-white/10"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void uploadAttachmentFile(file, "initial");
                e.currentTarget.value = "";
              }}
              disabled={!canStartNewOutreach}
                className="mt-2 block w-full text-xs text-neutral-400 file:mr-2 file:rounded-md file:border file:border-white/10 file:bg-white/5 file:px-2 file:py-1 file:text-xs file:text-neutral-200"
              />
              <div className="mt-1 text-[11px] text-neutral-500">
                Attach image/video/document files directly from your device.
              </div>
            <button
              onClick={() => {
                void handleCreateThread();
              }}
              disabled={
                !canStartNewOutreach ||
                !selectedAthlete ||
                creatingThread ||
                initialMessage.trim().length === 0 ||
                initialAttachments.some((a) => !a.mediaAssetId)
              }
              className="mt-2 w-full rounded-lg bg-white px-3 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {selectedAthlete?.existingThreadId ? "Open Thread" : "Create Thread"}
            </button>
          </div>
        </div>
      }
    >
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)] min-h-[72vh]">
          <aside
            className={`border-r border-white/10 ${showThreadListMobile ? "block" : "hidden"} md:block`}
          >
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Messages</div>
                <div className="text-xs text-neutral-500">{threads.length} threads</div>
              </div>
            </div>
            <div className="max-h-[68vh] overflow-y-auto p-2">
              {threadsLoading ? (
                <div className="px-3 py-4 text-xs text-neutral-500">Loading threads…</div>
              ) : threads.length === 0 ? (
                <div className="px-3 py-4 text-xs text-neutral-500">No threads yet.</div>
              ) : (
                threads.map((t) => {
                  const peerLabel =
                    user.id === t.coachUserId
                      ? t.athleteName || `Athlete ${t.athleteUserId}`
                      : t.coachName || `Coach ${t.coachUserId}`;
                  const active = t.threadId === activeThreadId;
                  return (
                    <button
                      key={t.threadId}
                      onClick={() => {
                        setActiveThreadId(t.threadId);
                        setShowThreadListMobile(false);
                        setThreads((prev) =>
                          prev.map((pt) =>
                            pt.threadId === t.threadId ? { ...pt, unreadCount: 0 } : pt
                          )
                        );
                      }}
                      className={`mb-2 w-full rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-cyan-400/40 bg-cyan-400/10"
                          : "border-white/10 bg-neutral-950/30 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{peerLabel}</div>
                          {t.unreadCount > 0 ? (
                            <span className="rounded-full bg-cyan-400/25 px-2 py-0.5 text-[10px] text-cyan-200">
                              {t.unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[10px] text-neutral-500">{formatTime(t.lastMessageAt)}</div>
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-neutral-400">
                        {t.lastMessageBody ?? "No messages yet"}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className={`${showThreadListMobile ? "hidden" : "block"} md:block`}>
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    {activeThread ? `Conversation ${activeThread.threadId.slice(0, 8)}` : "Select a thread"}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {activeThread ? `Last message: ${formatTime(activeThread.lastMessageAt)}` : "Choose from left"}
                  </div>
                </div>
                <button
                  onClick={() => setShowThreadListMobile(true)}
                  className="md:hidden rounded-lg border border-white/10 px-3 py-1 text-xs hover:bg-white/10"
                >
                  Back
                </button>
              </div>
            </div>

            <div className="flex h-[60vh] flex-col">
              <div className="flex-1 overflow-y-auto p-4">
                {!activeThread ? (
                  <div className="text-sm text-neutral-500">Pick a conversation to start messaging.</div>
                ) : messagesLoading ? (
                  <div className="text-sm text-neutral-500">Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div className="text-sm text-neutral-500">No messages yet in this thread.</div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((m) => {
                      const mine = m.senderUserId === user.id;
                      return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${
                              mine
                                ? "bg-cyan-500/20 border border-cyan-400/30"
                                : "bg-neutral-900 border border-white/10"
                            }`}
                          >
                            <div className="break-words">{m.body}</div>
                            {m.attachments?.length ? (
                              <div className="mt-2 space-y-1">
                                {m.attachments.map((a) => (
                                  <a
                                    key={`${m.id}-${a.mediaAssetId}`}
                                    href={a.publicUrl ?? "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block rounded-md border border-white/10 bg-neutral-950/30 px-2 py-1 text-xs text-cyan-200 hover:bg-white/10"
                                  >
                                    [{a.kind}] {a.publicUrl ?? "attachment"}
                                  </a>
                                ))}
                              </div>
                            ) : null}
                            <div className="mt-1 text-[10px] text-neutral-500">
                              user {m.senderUserId} • {formatTime(m.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    disabled={!activeThread || sending}
                    className="min-h-[44px] w-full resize-none rounded-xl border border-white/10 bg-neutral-950/30 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/10 disabled:opacity-60"
                    placeholder={activeThread ? "Write a message…" : "Select a thread first"}
                  />
                  <button
                    onClick={() => {
                      void handleSend();
                    }}
                    disabled={
                      !activeThread ||
                      sending ||
                      composer.trim().length === 0 ||
                      composerHasPendingUploads
                    }
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Send
                  </button>
                </div>
                {composerAttachments.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {composerAttachments.map((att, idx) => (
                      <div
                        key={att.localId}
                        className="flex items-center justify-between rounded-md border border-white/10 bg-neutral-950/30 px-2 py-1"
                      >
                        <div className="truncate text-[11px] text-neutral-300">
                          [{att.kind}] {att.filename || att.publicUrl}{" "}
                          {typeof att.progress === "number" && att.progress < 100 ? `(${att.progress}%)` : ""}
                        </div>
                        <button
                          onClick={() =>
                            setComposerAttachments((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="ml-2 rounded border border-white/10 px-1 text-[10px] hover:bg-white/10"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void uploadAttachmentFile(file, "composer");
                    e.currentTarget.value = "";
                  }}
                  disabled={!activeThread || sending}
                  className="mt-2 block w-full text-xs text-neutral-400 file:mr-2 file:rounded-md file:border file:border-white/10 file:bg-white/5 file:px-2 file:py-1 file:text-xs file:text-neutral-200"
                />
                <div className="mt-1 text-[11px] text-neutral-500">
                  Attach image/video/document files directly from your device.
                </div>
                {composerHasPendingUploads ? (
                  <div className="mt-1 text-[11px] text-amber-300">
                    Wait for uploads to finish before sending.
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
