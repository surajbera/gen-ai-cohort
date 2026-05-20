import { useEffect, useRef, useState } from "react";
import { CopyIcon, FileText, MessageSquare, RefreshCcwIcon } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  type PromptInputStatus,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  listMessages,
  streamChat,
  type Message as ApiMessage,
  type Pdf,
} from "@/lib/api";

type Props = {
  pdf: Pdf;
};

// Reasoning lives alongside each assistant message so the Thinking panel
// stays available after the answer completes (current session only).
type ChatMsg = ApiMessage & { reasoning?: string };

// Active stream state. `reasoningText` is markdown built from the NDJSON
// status/sources events; `answer` is the model's answer tokens accumulated.
type Streaming = {
  reasoningText: string;
  answer: string;
};

// Multi-turn chat scoped to a single PDF. The transport is NDJSON (status |
// sources | token events); we render the trace via Reasoning and the answer
// via MessageResponse (which routes fenced code blocks through CodeBlock).
export function ChatPanel({ pdf }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<Streaming | null>(null);
  const [status, setStatus] = useState<PromptInputStatus>("ready");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setStreaming(null);
    setStatus("ready");
    listMessages(pdf.id).then((msgs) => {
      if (!cancelled) setMessages(msgs);
    });
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [pdf.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || status !== "ready" || pdf.status !== "ready") return;

    setDraft("");
    setStatus("submitted");
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      },
    ]);
    setStreaming({ reasoningText: "", answer: "" });

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      let reasoning = "";
      let answer = "";
      await streamChat(
        pdf.id,
        text,
        (event) => {
          if (event.type === "status") {
            reasoning = appendBullet(reasoning, event.text);
            setStreaming({ reasoningText: reasoning, answer });
          } else if (event.type === "sources") {
            if (event.pages.length) {
              reasoning = appendBullet(
                reasoning,
                `Found chunks on ${event.pages.length === 1 ? "page" : "pages"} ${event.pages.join(", ")}`,
              );
              setStreaming({ reasoningText: reasoning, answer });
            }
          } else if (event.type === "token") {
            answer += event.text;
            setStreaming({ reasoningText: reasoning, answer });
            setStatus("streaming");
          }
        },
        ac.signal,
      );
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: answer,
          created_at: new Date().toISOString(),
          reasoning: reasoning || undefined,
        },
      ]);
      setStreaming(null);
      setStatus("ready");
    } catch (err) {
      setStreaming(null);
      setStatus("error");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: `[error] ${err instanceof Error ? err.message : "request failed"}`,
          created_at: new Date().toISOString(),
        },
      ]);
      setTimeout(() => setStatus("ready"), 1500);
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore - clipboard may be unavailable in insecure contexts
    }
  }

  function handleRetry(messageId: number) {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx <= 0) return;
    const previousUser = messages[idx - 1];
    if (previousUser?.role !== "user") return;
    setMessages((prev) => prev.slice(0, idx - 1));
    setDraft(previousUser.content);
    // Drop the cursor at the end of the restored draft so the user can tweak
    // and resubmit without clicking.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  }

  const lastAssistantId = [...messages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  const inputDisabled = pdf.status !== "ready" || status !== "ready";

  // Industry-standard chat UX: keep the cursor in the input whenever it's
  // usable, so the user can type immediately after switching PDFs, after a
  // PDF finishes indexing, or after an answer streams in. Skipped on
  // touch-primary devices (phones/tablets) so we don't force the on-screen
  // keyboard open unprompted — that's also what ChatGPT does.
  useEffect(() => {
    if (inputDisabled) return;
    if (typeof window === "undefined") return;
    const isPointerFine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!isPointerFine) return;
    // RAF gives layout a tick to settle (e.g. when re-enabling the textarea
    // after `disabled` was true, focus can race the React commit otherwise).
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [pdf.id, inputDisabled]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-w-0 shrink-0 items-center gap-2 border-b px-4 py-3">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span
          className="min-w-0 flex-1 truncate text-sm font-medium"
          title={pdf.filename}
        >
          {pdf.filename}
        </span>
      </header>

      <Conversation>
        <ConversationContent>
          {messages.length === 0 && streaming === null ? (
            <ConversationEmptyState
              icon={<MessageSquare className="h-8 w-8" />}
              title={
                pdf.status === "ready"
                  ? "Ask anything about this PDF"
                  : pdf.status === "indexing"
                    ? "Indexing in progress"
                    : "Indexing failed"
              }
              description={
                pdf.status === "ready"
                  ? "Answers are grounded in the PDF and cite page numbers."
                  : pdf.status === "indexing"
                    ? "Chat will unlock once embeddings are ready."
                    : "This PDF couldn't be indexed. Try deleting and re-uploading."
              }
            />
          ) : (
            <>
              {messages.map((m) => (
                <Message key={m.id} from={m.role}>
                  <MessageContent>
                    {m.reasoning && (
                      <Reasoning isStreaming={false} defaultOpen={false}>
                        <ReasoningTrigger />
                        <ReasoningContent>{m.reasoning}</ReasoningContent>
                      </Reasoning>
                    )}
                    <MessageResponse>{m.content}</MessageResponse>
                  </MessageContent>
                  {m.role === "assistant" && m.id === lastAssistantId && (
                    <MessageActions>
                      <MessageAction
                        tooltip="Retry"
                        onClick={() => handleRetry(m.id)}
                      >
                        <RefreshCcwIcon className="h-3.5 w-3.5" />
                      </MessageAction>
                      <MessageAction
                        tooltip="Copy"
                        onClick={() => handleCopy(m.content)}
                      >
                        <CopyIcon className="h-3.5 w-3.5" />
                      </MessageAction>
                    </MessageActions>
                  )}
                </Message>
              ))}
              {streaming !== null && (
                <Message from="assistant">
                  <MessageContent>
                    {streaming.reasoningText && (
                      <Reasoning isStreaming={!streaming.answer}>
                        <ReasoningTrigger />
                        <ReasoningContent>
                          {streaming.reasoningText}
                        </ReasoningContent>
                      </Reasoning>
                    )}
                    {streaming.answer && (
                      <MessageResponse>{streaming.answer}</MessageResponse>
                    )}
                  </MessageContent>
                </Message>
              )}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t p-3">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              pdf.status === "ready"
                ? "Ask a question about this PDF..."
                : "Waiting for indexing..."
            }
            disabled={inputDisabled}
            autoFocus
          />
          <PromptInputToolbar>
            <PromptInputSubmit
              status={status}
              disabled={inputDisabled || !draft.trim()}
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
}

// Appends a markdown bullet line; used to grow the Reasoning trace step by step.
function appendBullet(prev: string, line: string): string {
  return prev ? `${prev}\n- ${line}` : `- ${line}`;
}
