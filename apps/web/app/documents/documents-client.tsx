"use client";

import Link from "next/link";
import { SafeUserButton, useSafeAuth } from "@/components/clerk-safe";
import { UpgradeNotice } from "@/components/upgrade-notice";
import { useTheme } from "next-themes";
import {
  ArrowRight,
  BrainCircuit,
  ChevronLeft,
  ClipboardList,
  FileQuestion,
  FileText,
  Loader2,
  Menu,
  Moon,
  NotebookText,
  Search,
  Sparkles,
  Sun,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type AppUser = {
  firstName: string;
  fullName: string;
  email: string;
};

type HumanDocument = {
  id: string;
  title: string;
  file_name: string;
  mime_type: string;
  storage_url: string;
  summary: string;
  extracted_text: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type CopilotAction = "summary" | "question" | "notes" | "action_items";

type CopilotResult = {
  action: CopilotAction;
  title: string;
  answer: string;
  items: { title: string; description: string }[];
};

const actions: { id: CopilotAction; label: string; icon: typeof FileText }[] = [
  { id: "summary", label: "Summarize", icon: Sparkles },
  { id: "notes", label: "Notes", icon: NotebookText },
  { id: "action_items", label: "Actions", icon: ClipboardList },
  { id: "question", label: "Ask", icon: FileQuestion },
];

export function DocumentsClient({ user, clerkReady }: { user: AppUser; clerkReady: boolean }) {
  if (!clerkReady) return <DocumentsPreview user={user} />;
  return <AuthenticatedDocumentsClient user={user} />;
}

function AuthenticatedDocumentsClient({ user }: { user: AppUser }) {
  const { getToken } = useSafeAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [documents, setDocuments] = useState<HumanDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [result, setResult] = useState<CopilotResult | null>(null);
  const [question, setQuestion] = useState("");
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isThinking, setIsThinking] = useState<CopilotAction | null>(null);
  const [error, setError] = useState("");

  const activeDocument = useMemo(
    () => documents.find((document) => document.id === activeDocumentId) ?? documents[0] ?? null,
    [activeDocumentId, documents],
  );

  const filteredDocuments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((document) => `${document.title} ${document.file_name}`.toLowerCase().includes(needle));
  }, [documents, query]);

  useEffect(() => {
    void loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeDocumentId && documents[0]) setActiveDocumentId(documents[0].id);
  }, [activeDocumentId, documents]);

  async function authHeaders(json = true): Promise<Record<string, string>> {
    const token = await getToken();
    if (!token) throw new Error("Missing Clerk session token");
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  async function loadDocuments() {
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/documents`, { headers });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as HumanDocument[];
      setDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load documents");
    }
  }

  async function uploadDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsUploading(true);
    setError("");
    try {
      const headers = await authHeaders(false);
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`${API_URL}/documents/upload`, { method: "POST", headers, body });
      if (!response.ok) throw new Error(await response.text());
      const uploaded = (await response.json()) as HumanDocument;
      setDocuments((current) => [uploaded, ...current.filter((document) => document.id !== uploaded.id)]);
      setActiveDocumentId(uploaded.id);
      setResult({ action: "summary", title: "Document summary", answer: uploaded.summary, items: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload document");
    } finally {
      setIsUploading(false);
    }
  }

  async function runCopilot(action: CopilotAction, event?: FormEvent) {
    event?.preventDefault();
    if (!activeDocument || isThinking) return;
    if (action === "question" && !question.trim()) return;
    setIsThinking(action);
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/documents/${activeDocument.id}/copilot`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action, question: question.trim() }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as CopilotResult;
      setResult(data);
      if (action === "summary") {
        setDocuments((current) => current.map((document) => (document.id === activeDocument.id ? { ...document, summary: data.answer } : document)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document Copilot could not finish");
    } finally {
      setIsThinking(null);
    }
  }

  async function deleteDocument(documentId: string) {
    setError("");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/documents/${documentId}`, { method: "DELETE", headers });
      if (!response.ok) throw new Error(await response.text());
      setDocuments((current) => current.filter((document) => document.id !== documentId));
      if (activeDocumentId === documentId) {
        setActiveDocumentId(null);
        setResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete document");
    }
  }

  const sidebar = (
    <DocumentSidebar
      documents={filteredDocuments}
      activeDocumentId={activeDocument?.id ?? null}
      query={query}
      onQuery={setQuery}
      onSelect={(documentId) => {
        setActiveDocumentId(documentId);
        setSidebarOpen(false);
        const selected = documents.find((document) => document.id === documentId);
        setResult(selected?.summary ? { action: "summary", title: "Document summary", answer: selected.summary, items: [] } : null);
      }}
      onDelete={(documentId) => void deleteDocument(documentId)}
    />
  );

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <div className="lg:hidden">
        <div
          className={cn("fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm transition-opacity", sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0")}
          onClick={() => setSidebarOpen(false)}
        />
        <aside className={cn("fixed inset-y-0 left-0 z-50 w-80 max-w-[86vw] border-r bg-card/95 p-4 shadow-soft backdrop-blur-2xl transition-transform", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
          <div className="mb-4 flex items-center justify-between">
            <Brand />
            <Button variant="ghost" size="icon" title="Close documents" onClick={() => setSidebarOpen(false)}><X className="h-4 w-4" /></Button>
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
            <Button variant="ghost" size="icon" className="lg:hidden" title="Open documents" onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/dashboard"><ChevronLeft className="h-4 w-4" />Dashboard</Link></Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Document Copilot</p>
              <p className="text-xs text-muted-foreground">{user.firstName}, upload, summarize, ask, and extract next steps</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" title="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <SafeUserButton />
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
          <section className="flex flex-col gap-4">
            <UploadPanel isUploading={isUploading} onUpload={uploadDocument} />
            {error && <UpgradeNotice message={error} />}
            <DocumentWorkspace document={activeDocument} result={result} isThinking={isThinking} question={question} onQuestion={setQuestion} onRun={(action, event) => void runCopilot(action, event)} />
          </section>
          <section className="flex flex-col gap-4">
            <ContextPanel document={activeDocument} />
            <ResultPanel result={result} isThinking={isThinking} />
          </section>
        </div>
      </section>
    </main>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 font-semibold">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground"><FileText className="h-5 w-5" /></span>
      <span>
        <span className="block leading-5">HumanOS AI</span>
        <span className="block text-xs font-normal text-muted-foreground">Document Copilot</span>
      </span>
    </Link>
  );
}

function DocumentSidebar({ documents, activeDocumentId, query, onQuery, onSelect, onDelete }: { documents: HumanDocument[]; activeDocumentId: string | null; query: string; onQuery: (value: string) => void; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-4">
      <div className="flex items-center gap-2 rounded-md border bg-background/70 px-3 py-2 text-sm text-muted-foreground">
        <Search className="h-4 w-4" />
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search documents" className="min-w-0 flex-1 bg-transparent outline-none" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {documents.length === 0 ? (
          <div className="rounded-lg border bg-background/65 p-4 text-sm leading-6 text-muted-foreground">Uploaded PDF, DOCX, and TXT files will appear here.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {documents.map((document) => (
              <button key={document.id} onClick={() => onSelect(document.id)} className={cn("group rounded-lg border p-3 text-left transition hover:bg-muted", activeDocumentId === document.id ? "border-primary bg-primary/10" : "bg-background/65")}>
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{document.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{document.file_name || "Untitled"}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{String(document.meta?.chunk_count ?? 0)} chunks indexed</p>
                  </div>
                  <span onClick={(event) => { event.stopPropagation(); onDelete(document.id); }} role="button" tabIndex={0} title="Delete document" className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100">
                    <Trash2 className="h-4 w-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadPanel({ isUploading, onUpload }: { isUploading: boolean; onUpload: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <Card className="bg-card/70 backdrop-blur-2xl">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-primary"><UploadCloud className="h-4 w-4" /> Upload document</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">PDF, DOCX, or TXT. HumanOS extracts text, generates a summary, and indexes embeddings in Qdrant.</p>
        </div>
        <label className={cn("inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft transition hover:bg-primary/90", isUploading && "pointer-events-none opacity-70")}>
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {isUploading ? "Processing" : "Choose file"}
          <input className="sr-only" type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onUpload} disabled={isUploading} />
        </label>
      </CardContent>
    </Card>
  );
}

function DocumentWorkspace({ document, result, isThinking, question, onQuestion, onRun }: { document: HumanDocument | null; result: CopilotResult | null; isThinking: CopilotAction | null; question: string; onQuestion: (value: string) => void; onRun: (action: CopilotAction, event?: FormEvent) => void }) {
  return (
    <Card className="min-h-[32rem] bg-card/70 backdrop-blur-2xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex min-w-0 items-center gap-2"><BrainCircuit className="h-5 w-5 text-secondary" />{document ? <span className="truncate">{document.title}</span> : "No document selected"}</span>
          {document && <span className="rounded-md border bg-background/60 px-2 py-1 text-xs text-muted-foreground">{document.status}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!document ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border bg-background/60 p-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="mt-4 text-lg font-semibold">Upload a document to begin</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">HumanOS will extract readable text, store embeddings in Qdrant, and make the file available for summary, notes, Q&A, and action extraction.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-4">
              {actions.map((action) => (
                <Button key={action.id} variant={result?.action === action.id ? "default" : "outline"} className="justify-start" onClick={() => onRun(action.id)} disabled={Boolean(isThinking) || (action.id === "question" && !question.trim())}>
                  {isThinking === action.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <action.icon className="h-4 w-4" />}
                  {action.label}
                </Button>
              ))}
            </div>
            <form onSubmit={(event) => onRun("question", event)} className="rounded-xl border bg-background/65 p-3">
              <Textarea value={question} onChange={(event) => onQuestion(event.target.value)} placeholder="Ask a question from this document..." className="min-h-20 border-0 bg-transparent focus:ring-0" />
              <div className="mt-2 flex justify-end">
                <Button disabled={!question.trim() || Boolean(isThinking)}>{isThinking === "question" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}Ask document</Button>
              </div>
            </form>
            <div className="rounded-xl border bg-background/65 p-4">
              <p className="text-sm font-semibold">Instant summary</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{document.summary || result?.answer || "Run Summarize to generate a concise overview."}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ContextPanel({ document }: { document: HumanDocument | null }) {
  const textLength = Number(document?.meta?.text_length ?? document?.extracted_text.length ?? 0);
  return (
    <Card className="bg-card/70 backdrop-blur-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5 text-primary" /> Document context</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <Metric label="Documents" value={document ? "1 active" : "0 active"} />
        <Metric label="Text" value={textLength ? `${Math.round(textLength / 100) / 10}k chars` : "0 chars"} />
        <Metric label="Embeddings" value={`${String(document?.meta?.chunk_count ?? 0)} chunks`} />
      </CardContent>
    </Card>
  );
}

function ResultPanel({ result, isThinking }: { result: CopilotResult | null; isThinking: CopilotAction | null }) {
  return (
    <Card className="flex-1 bg-card/70 backdrop-blur-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-5 w-5 text-secondary" /> Copilot output</CardTitle></CardHeader>
      <CardContent>
        {isThinking && !result ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading document context</div>
        ) : result ? (
          <div className="space-y-4">
            <div>
              <p className="text-lg font-semibold">{result.title}</p>
              {result.answer && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{result.answer}</p>}
            </div>
            {result.items.length > 0 && (
              <div className="space-y-2">
                {result.items.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-lg border bg-background/65 p-3">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border bg-background/60 p-8 text-center text-sm text-muted-foreground">
            <Sparkles className="mb-3 h-8 w-8" />
            Choose a document action to generate grounded output.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/65 p-4">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function DocumentsPreview({ user }: { user: AppUser }) {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-3xl rounded-[1.5rem] border bg-card/70 p-8 shadow-soft backdrop-blur-2xl">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary"><FileText className="h-4 w-4" /> Document Copilot</p>
        <h1 className="mt-4 text-3xl font-semibold">Welcome, {user.firstName}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">Connect Clerk to upload and analyze PDF, DOCX, and TXT documents inside HumanOS AI.</p>
        <Button asChild className="mt-6"><Link href="/sign-in">Sign in</Link></Button>
      </div>
    </main>
  );
}

