"use client";

import Link from "next/link";
import { SafeUserButton, useSafeAuth } from "@/components/clerk-safe";
import { useTheme } from "next-themes";
import {
  ArrowUp,
  Bot,
  ChevronLeft,
  Loader2,
  Menu,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ChatUser = {
  firstName: string;
  fullName: string;
  email: string;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type LocalMessage = Message | { id: string; role: "user" | "assistant"; content: string; created_at: string };

const starterPrompts = [
  "Help me plan my day around my highest leverage goal.",
  "Summarize what I should focus on for my career this week.",
  "What should I remember from my recent decisions?",
];

export function ChatClient({ user, clerkReady }: { user: ChatUser; clerkReady: boolean }) {
  if (!clerkReady) {
    return <ChatPreview user={user} />;
  }

  return <AuthenticatedChatClient user={user} />;
}

function AuthenticatedChatClient({ user }: { user: ChatUser }) {
  const { getToken } = useSafeAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, conversations],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function authHeaders() {
    const token = await getToken();
    if (!token) throw new Error("Missing Clerk session token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  async function loadConversations() {
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/chat/conversations`, { headers });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as Conversation[];
      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load conversations");
    }
  }

  async function loadMessages(conversationId: string) {
    setIsLoadingHistory(true);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`, { headers });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as Message[];
      setActiveConversationId(conversationId);
      setMessages(data);
      setSidebarOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load messages");
    } finally {
      setIsLoadingHistory(false);
    }
  }

  function startNewChat() {
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setError("");
    setSidebarOpen(false);
  }

  async function sendMessage(event?: FormEvent, override?: string) {
    event?.preventDefault();
    const content = (override ?? input).trim();
    if (!content || isStreaming) return;


    const userMessage: LocalMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    const assistantId = `local-assistant-${Date.now()}`;
    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: "assistant", content: "", created_at: new Date().toISOString() },
    ]);
    setInput("");
    setIsStreaming(true);
    setError("");

    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/chat/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: content, conversation_id: activeConversationId }),
      });

      if (!response.ok || !response.body) throw new Error(await response.text());

      const conversationId = response.headers.get("X-Conversation-Id");
      if (conversationId && conversationId !== activeConversationId) {
        setActiveConversationId(conversationId);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const result = await reader.read();
        done = result.done;
        const chunk = decoder.decode(result.value ?? new Uint8Array(), { stream: !done });
        if (chunk) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId ? { ...message, content: message.content + chunk } : message,
            ),
          );
        }
      }

      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to stream response");
      setMessages((current) => current.filter((message) => message.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  }

  const sidebar = (
    <ConversationSidebar
      conversations={conversations}
      activeConversationId={activeConversationId}
      onNewChat={startNewChat}
      onSelect={loadMessages}
      isLoading={isLoadingHistory}
      clerkReady={true}
    />
  );

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <div className="lg:hidden">
        <div
          className={cn(
            "fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm transition-opacity",
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setSidebarOpen(false)}
        />
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-80 max-w-[86vw] border-r bg-card/95 p-4 shadow-soft backdrop-blur-2xl transition-transform",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <Brand />
            <Button variant="ghost" size="icon" title="Close conversations" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {sidebar}
        </aside>
      </div>

      <aside className="hidden h-screen w-80 shrink-0 border-r bg-card/70 p-4 backdrop-blur-2xl lg:block">
        <Brand />
        <div className="mt-5">{sidebar}</div>
      </aside>

      <section className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/75 px-4 backdrop-blur-2xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" title="Open conversations" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/dashboard"><ChevronLeft className="h-4 w-4" />Dashboard</Link>
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{activeConversation?.title ?? "New chat"}</p>
              <p className="text-xs text-muted-foreground">HumanOS AI Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <SafeUserButton />
          </div>
        </header>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
              {messages.length === 0 ? (
                <EmptyState user={user} onPrompt={(prompt) => void sendMessage(undefined, prompt)} disabled={false} />
              ) : (
                messages.map((message) => <MessageBubble key={message.id} message={message} isStreaming={isStreaming} />)
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <form onSubmit={sendMessage} className="border-t bg-background/80 p-4 backdrop-blur-2xl sm:p-5">
            <div className="mx-auto max-w-3xl rounded-[1.25rem] border bg-card/80 p-2 shadow-soft backdrop-blur-2xl">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Message HumanOS AI..."
                className="max-h-44 min-h-16 border-0 bg-transparent focus:ring-0"
                disabled={isStreaming}
              />
              <div className="flex items-center justify-between px-2 pb-1">
                <p className="text-xs text-muted-foreground">Streaming responses are saved to PostgreSQL.</p>
                <Button size="icon" title="Send message" disabled={!input.trim() || isStreaming}>
                  {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 font-semibold">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Sparkles className="h-5 w-5" />
      </span>
      <span>
        <span className="block leading-5">HumanOS AI</span>
        <span className="block text-xs font-normal text-muted-foreground">AI chat assistant</span>
      </span>
    </Link>
  );
}

function ConversationSidebar({
  conversations,
  activeConversationId,
  onNewChat,
  onSelect,
  isLoading,
  clerkReady,
}: {
  conversations: Conversation[];
  activeConversationId: string | null;
  onNewChat: () => void;
  onSelect: (conversationId: string) => void;
  isLoading: boolean;
  clerkReady: boolean;
}) {
  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-4">
      <Button onClick={onNewChat} className="w-full justify-start" disabled={!clerkReady}>
        <Plus className="h-4 w-4" /> New chat
      </Button>
      <div className="flex items-center gap-2 rounded-md border bg-background/70 px-3 py-2 text-sm text-muted-foreground">
        <Search className="h-4 w-4" /> Search conversations
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading history</div>
        ) : conversations.length === 0 ? (
          <p className="rounded-lg border bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
            Your saved conversations will appear here after your first message.
          </p>
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted",
                  activeConversationId === conversation.id && "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                <span className="line-clamp-2">{conversation.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ user, onPrompt, disabled }: { user: ChatUser; onPrompt: (prompt: string) => void; disabled: boolean }) {
  return (
    <section className="flex min-h-[55vh] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
        <Sparkles className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">How can I help, {user.firstName}?</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">Ask about life, study, career, documents, goals, memory, or today&apos;s next best action.</p>
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPrompt(prompt)}
            disabled={disabled}
            className="rounded-lg border bg-card/70 p-4 text-left text-sm leading-6 shadow-soft transition hover:-translate-y-0.5 hover:bg-card disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>
    </section>
  );
}

function MessageBubble({ message, isStreaming }: { message: LocalMessage; isStreaming: boolean }) {
  const isAssistant = message.role === "assistant";
  return (
    <article className={cn("flex gap-3", isAssistant ? "items-start" : "items-start justify-end")}>
      {isAssistant && <Avatar icon="assistant" />}
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-soft sm:max-w-[78%]",
          isAssistant ? "border bg-card/80" : "bg-primary text-primary-foreground",
        )}
      >
        {message.content ? message.content : isStreaming ? <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-muted-foreground" /> : null}
      </div>
      {!isAssistant && <Avatar icon="user" />}
    </article>
  );
}

function Avatar({ icon }: { icon: "assistant" | "user" }) {
  return (
    <div className={cn("mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md", icon === "assistant" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground")}>
      {icon === "assistant" ? <Bot className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-lg border bg-card/80 p-4 text-sm leading-6 shadow-soft">
      <p className="font-semibold">Clerk keys required for secure chat</p>
      <p className="mt-1 text-muted-foreground">
        Add real Clerk keys to enable authenticated backend calls. The UI is ready, but streaming is disabled until Clerk is configured.
      </p>
    </div>
  );
}

function ChatPreview({ user }: { user: ChatUser }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden h-screen w-80 shrink-0 border-r bg-card/70 p-4 backdrop-blur-2xl lg:block">
        <Brand />
        <div className="mt-5">
          <Button className="w-full justify-start" disabled><Plus className="h-4 w-4" /> New chat</Button>
          <SetupNotice />
        </div>
      </aside>
      <section className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-background/75 px-4 backdrop-blur-2xl sm:px-6">
          <div>
            <p className="text-sm font-semibold">AI Chat</p>
            <p className="text-xs text-muted-foreground">Secure streaming requires Clerk keys</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button asChild><Link href="/sign-in">Login</Link></Button>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
              <Sparkles className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">AI Chat is ready, {user.firstName}.</h1>
            <p className="mt-4 text-muted-foreground">Add real Clerk keys to enable authenticated streaming calls to FastAPI and PostgreSQL conversation history.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {starterPrompts.map((prompt) => (
                <div key={prompt} className="rounded-lg border bg-card/70 p-4 text-left text-sm leading-6 shadow-soft">{prompt}</div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}


