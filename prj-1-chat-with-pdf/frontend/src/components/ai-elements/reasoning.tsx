// Vercel AI Elements `Reasoning` (MIT). Trimmed for this app:
//   - drops `Shimmer` (uses a simple animate-pulse instead)
//   - drops `useControllableState` dep (we never use the controlled `open` prop)
//   - keeps Radix Collapsible for smooth slide animations
//
// Behavior: auto-opens while `isStreaming`, records the duration once
// streaming flips off, and auto-closes after a 1s delay so the user has a
// moment to register the final state before the panel collapses.

import { BrainIcon, ChevronDownIcon } from "lucide-react";
import {
  createContext,
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Streamdown } from "streamdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface ReasoningCtx {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number | undefined;
}

const Ctx = createContext<ReasoningCtx | null>(null);

export const useReasoning = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("Reasoning.* must be used inside <Reasoning>");
  return v;
};

const AUTO_CLOSE_MS = 1000;

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  defaultOpen?: boolean;
  duration?: number;
};

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    defaultOpen,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen ?? isStreaming);
    const [duration, setDuration] = useState<number | undefined>(durationProp);
    const startRef = useRef<number | null>(isStreaming ? Date.now() : null);
    const wasStreamingRef = useRef(isStreaming);
    const hasAutoClosedRef = useRef(false);

    // Open while streaming, record duration when streaming ends.
    useEffect(() => {
      if (isStreaming) {
        wasStreamingRef.current = true;
        if (startRef.current === null) startRef.current = Date.now();
        if (!isOpen && !hasAutoClosedRef.current) setIsOpen(true);
      } else if (startRef.current !== null) {
        setDuration(Math.max(1, Math.ceil((Date.now() - startRef.current) / 1000)));
        startRef.current = null;
      }
    }, [isStreaming, isOpen]);

    // Auto-close once shortly after streaming ends.
    useEffect(() => {
      if (
        wasStreamingRef.current &&
        !isStreaming &&
        isOpen &&
        !hasAutoClosedRef.current
      ) {
        const t = setTimeout(() => {
          setIsOpen(false);
          hasAutoClosedRef.current = true;
        }, AUTO_CLOSE_MS);
        return () => clearTimeout(t);
      }
    }, [isStreaming, isOpen]);

    const value = useMemo(
      () => ({ duration, isOpen, isStreaming, setIsOpen }),
      [duration, isOpen, isStreaming],
    );

    return (
      <Ctx.Provider value={value}>
        <Collapsible
          className={cn("not-prose", className)}
          onOpenChange={setIsOpen}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </Ctx.Provider>
    );
  },
);
Reasoning.displayName = "Reasoning";

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode;
};

const defaultMessage = (isStreaming: boolean, duration?: number) => {
  if (isStreaming) {
    return <span className="animate-pulse">Thinking...</span>;
  }
  if (duration === undefined) return <span>Thought for a few seconds</span>;
  return <span>Thought for {duration}s</span>;
};

export const ReasoningTrigger = memo(
  ({
    className,
    children,
    getThinkingMessage = defaultMessage,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning();
    return (
      <CollapsibleTrigger
        className={cn(
          "flex w-fit items-center gap-2 rounded-md px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon
              className={cn("h-3.5 w-3.5", isStreaming && "text-primary")}
            />
            {getThinkingMessage(isStreaming, duration)}
            <ChevronDownIcon
              className={cn(
                "h-3 w-3 transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </>
        )}
      </CollapsibleTrigger>
    );
  },
);
ReasoningTrigger.displayName = "ReasoningTrigger";

export type ReasoningContentProps = ComponentProps<typeof CollapsibleContent> & {
  children: string;
};

// Renders the trace via Streamdown so markdown bullets/links work naturally.
export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => (
    <CollapsibleContent
      className={cn(
        "ml-1 mt-2 border-l-2 border-border pl-3 text-xs text-muted-foreground",
        "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
        className,
      )}
      {...props}
    >
      <Streamdown className="[&>*]:my-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4">
        {children}
      </Streamdown>
    </CollapsibleContent>
  ),
);
ReasoningContent.displayName = "ReasoningContent";
