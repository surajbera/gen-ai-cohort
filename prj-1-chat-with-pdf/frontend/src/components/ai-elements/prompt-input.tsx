// Inspired by Vercel AI Elements `PromptInput` (MIT). Trimmed for this app:
// no model picker, no file attachments, no screen capture - just a textarea
// with submit-on-Enter, auto-grow, and a status-aware submit button.
//
// API surface mirrors the upstream component so swapping in the full version
// later (`npx ai-elements@latest add prompt-input`) is mostly drop-in.

import { Loader2, Send, Square } from "lucide-react";
import {
  forwardRef,
  type ComponentProps,
  type FormHTMLAttributes,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Mirrors AI SDK `ChatStatus`: idle/submitted/streaming/ready/error.
export type PromptInputStatus = "ready" | "submitted" | "streaming" | "error";

export type PromptInputProps = FormHTMLAttributes<HTMLFormElement>;

// Form wrapper. Submit it (Enter or click) and your `onSubmit` fires.
export const PromptInput = ({ className, ...props }: PromptInputProps) => (
  <form
    className={cn(
      "flex w-full flex-col gap-2 rounded-xl border bg-background p-2 shadow-sm",
      className,
    )}
    {...props}
  />
);

export type PromptInputTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

// Auto-growing textarea. Enter submits the parent form; Shift+Enter inserts a newline.
export const PromptInputTextarea = forwardRef<HTMLTextAreaElement, PromptInputTextareaProps>(
  ({ className, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        e.currentTarget.form?.requestSubmit();
      }
    };
    return (
      <textarea
        ref={ref}
        rows={1}
        onKeyDown={handleKeyDown}
        className={cn(
          "min-h-[40px] w-full resize-none border-0 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
PromptInputTextarea.displayName = "PromptInputTextarea";

export type PromptInputToolbarProps = ComponentProps<"div">;

// Bottom row inside the prompt box. Holds the submit button (and could hold
// model picker, attach button, etc. in a richer UI).
export const PromptInputToolbar = ({ className, ...props }: PromptInputToolbarProps) => (
  <div className={cn("flex items-center justify-end gap-1", className)} {...props} />
);

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: PromptInputStatus;
};

// Submit button that swaps icon based on status: send / spinner / stop.
export const PromptInputSubmit = ({
  status = "ready",
  className,
  children,
  ...props
}: PromptInputSubmitProps) => {
  const icon =
    status === "streaming" ? (
      <Square className="h-3.5 w-3.5 fill-current" />
    ) : status === "submitted" ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : (
      <Send className="h-4 w-4" />
    );

  return (
    <Button
      type="submit"
      size="icon"
      className={cn("rounded-lg", className)}
      {...props}
    >
      {children ?? icon}
    </Button>
  );
};
