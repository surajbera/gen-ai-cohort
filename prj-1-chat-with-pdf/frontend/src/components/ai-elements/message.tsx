// Vercel AI Elements `Message` (MIT). Trimmed for this app: drops branching
// (`MessageBranch*` + `ButtonGroup` dep). Fenced code blocks in markdown are
// routed through the AI Elements `CodeBlock` via Streamdown's `components`
// override, so each code block in chat gets Shiki highlighting + copy button.

import {
  isValidElement,
  memo,
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { Components } from "streamdown";
import { Streamdown } from "streamdown";
import type { BundledLanguage } from "shiki";
import { Button } from "@/components/ui/button";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ai-elements/code-block";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type MessageRole = "user" | "assistant" | "system";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: MessageRole;
};

// Wraps a single chat turn. Adds `is-user` / `is-assistant` group markers
// so child components can style themselves via the `group-[.is-user]:*`
// utilities below.
export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className,
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

// Bubble for user messages, full-width plain text for the assistant.
export const MessageContent = ({
  className,
  children,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm",
      "group-[.is-user]:ml-auto group-[.is-user]:rounded-2xl group-[.is-user]:bg-secondary group-[.is-user]:px-3.5 group-[.is-user]:py-2 group-[.is-user]:text-foreground",
      "group-[.is-assistant]:text-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionsProps = ComponentProps<"div">;

// Toolbar row that lives below an assistant message (Copy, Retry, etc.).
// Fades in on hover/focus to keep the chat clean while idle.
export const MessageActions = ({
  className,
  children,
  ...props
}: MessageActionsProps) => (
  <div
    className={cn(
      "flex items-center gap-0.5 opacity-0 transition-opacity",
      "group-hover:opacity-100 focus-within:opacity-100",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

// Icon-only action button with an accessible label and optional tooltip.
export const MessageAction = ({
  tooltip,
  children,
  label,
  className,
  ...props
}: MessageActionProps) => {
  const button = (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      className={cn("h-7 w-7", className)}
      {...props}
    >
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (!tooltip) return button;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Streamdown turns ` ```ts\n...\n``` ` into <pre><code class="language-ts">...
// We override <pre> to render via the AI Elements `CodeBlock` (Shiki + copy).
const PreOverride = ({ children }: { children?: ReactNode }) => {
  if (!isValidElement(children)) return <pre>{children}</pre>;
  const codeProps = (children.props ?? {}) as {
    className?: string;
    children?: ReactNode;
  };
  const language = (codeProps.className?.match(/language-(\w+)/)?.[1] ??
    "text") as BundledLanguage;
  const code = String(codeProps.children ?? "").replace(/\n$/, "");
  return (
    <CodeBlock code={code} language={language} className="my-3">
      <CodeBlockHeader>
        <CodeBlockTitle>
          <CodeBlockFilename>{language}</CodeBlockFilename>
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton />
        </CodeBlockActions>
      </CodeBlockHeader>
    </CodeBlock>
  );
};

const streamdownComponents = { pre: PreOverride } as Components;

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

// Markdown renderer for the assistant's body. Memoized on `children` so token
// updates only re-render when the text actually changes.
export const MessageResponse = memo(
  ({ className, components, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full text-sm leading-relaxed",
        "[&>*]:my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1",
        "[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-[0.85em]",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        className,
      )}
      components={{ ...streamdownComponents, ...components }}
      {...props}
    />
  ),
  (prev, next) => prev.children === next.children,
);
MessageResponse.displayName = "MessageResponse";
