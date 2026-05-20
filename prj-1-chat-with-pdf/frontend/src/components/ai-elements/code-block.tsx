// Vercel AI Elements `CodeBlock` (MIT). Lightly trimmed for this app:
//   - drops the dark-class htmlStyle string spread (Shiki sometimes returns
//     htmlStyle as a `style="..."` string instead of an object — we only
//     spread the object form);
//   - keeps the full feature set: header / title / filename / actions / copy
//     button / language selector with sub-components.
//
// Two ways to use it:
//
// 1) Single-language (most common — what `MessageResponse` does for fenced
//    code blocks in chat):
//
//      <CodeBlock code={code} language="ts">
//        <CodeBlockHeader>
//          <CodeBlockTitle>
//            <CodeBlockFilename>{language}</CodeBlockFilename>
//          </CodeBlockTitle>
//          <CodeBlockActions>
//            <CodeBlockCopyButton />
//          </CodeBlockActions>
//        </CodeBlockHeader>
//      </CodeBlock>
//
// 2) Multi-language variant picker (e.g., docs that show "TS / JS / Python"
//    of the same snippet — the AI Elements Code Block demo):
//
//      <CodeBlock code={code[lang]} language={lang}>
//        <CodeBlockHeader>
//          <CodeBlockTitle><CodeBlockFilename>example</CodeBlockFilename></CodeBlockTitle>
//          <CodeBlockActions>
//            <CodeBlockLanguageSelector value={lang} onValueChange={setLang}>
//              <CodeBlockLanguageSelectorTrigger>
//                <CodeBlockLanguageSelectorValue />
//              </CodeBlockLanguageSelectorTrigger>
//              <CodeBlockLanguageSelectorContent>
//                <CodeBlockLanguageSelectorItem value="ts">TypeScript</CodeBlockLanguageSelectorItem>
//                <CodeBlockLanguageSelectorItem value="py">Python</CodeBlockLanguageSelectorItem>
//              </CodeBlockLanguageSelectorContent>
//            </CodeBlockLanguageSelector>
//            <CodeBlockCopyButton />
//          </CodeBlockActions>
//        </CodeBlockHeader>
//      </CodeBlock>

import { CheckIcon, CopyIcon } from "lucide-react";
import type { ComponentProps, CSSProperties, HTMLAttributes } from "react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BundledLanguage,
  BundledTheme,
  HighlighterGeneric,
  ThemedToken,
} from "shiki";
import { createHighlighter } from "shiki";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Shiki uses bitflags for font styles: 1=italic, 2=bold, 4=underline.
const isItalic = (fs: number | undefined) => Boolean(fs && fs & 1);
const isBold = (fs: number | undefined) => Boolean(fs && fs & 2);
const isUnderline = (fs: number | undefined) => Boolean(fs && fs & 4);

interface KeyedToken {
  token: ThemedToken;
  key: string;
}
interface KeyedLine {
  tokens: KeyedToken[];
  key: string;
}

const addKeysToTokens = (lines: ThemedToken[][]): KeyedLine[] =>
  lines.map((line, lineIdx) => ({
    key: `line-${lineIdx}`,
    tokens: line.map((token, tokenIdx) => ({
      key: `line-${lineIdx}-${tokenIdx}`,
      token,
    })),
  }));

const TokenSpan = ({ token }: { token: ThemedToken }) => {
  // Shiki may emit htmlStyle as either an object or a `style="..."` string.
  // Only object form is safely spreadable into a React style.
  const extra =
    typeof token.htmlStyle === "object" && token.htmlStyle !== null
      ? (token.htmlStyle as Record<string, string>)
      : undefined;
  return (
    <span
      className="dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)]"
      style={
        {
          backgroundColor: token.bgColor,
          color: token.color,
          fontStyle: isItalic(token.fontStyle) ? "italic" : undefined,
          fontWeight: isBold(token.fontStyle) ? "bold" : undefined,
          textDecoration: isUnderline(token.fontStyle) ? "underline" : undefined,
          ...extra,
        } as CSSProperties
      }
    >
      {token.content}
    </span>
  );
};

const LineSpan = ({ keyedLine }: { keyedLine: KeyedLine }) => (
  <span className="block">
    {keyedLine.tokens.length === 0
      ? "\n"
      : keyedLine.tokens.map(({ token, key }) => <TokenSpan key={key} token={token} />)}
  </span>
);

interface TokenizedCode {
  tokens: ThemedToken[][];
  fg: string;
  bg: string;
}

interface CodeBlockContextType {
  code: string;
}

const CodeBlockContext = createContext<CodeBlockContextType>({ code: "" });

// Caches: one Highlighter per language, one tokenized result per (lang, code).
const highlighterCache = new Map<
  string,
  Promise<HighlighterGeneric<BundledLanguage, BundledTheme>>
>();
const tokensCache = new Map<string, TokenizedCode>();
const subscribers = new Map<string, Set<(result: TokenizedCode) => void>>();

const getTokensCacheKey = (code: string, language: BundledLanguage) => {
  const start = code.slice(0, 100);
  const end = code.length > 100 ? code.slice(-100) : "";
  return `${language}:${code.length}:${start}:${end}`;
};

const getHighlighter = (language: BundledLanguage) => {
  const cached = highlighterCache.get(language);
  if (cached) return cached;
  const p = createHighlighter({
    langs: [language],
    themes: ["github-light", "github-dark"],
  });
  highlighterCache.set(language, p);
  return p;
};

// Sync fallback: each line is one inherit-colored token. Lets us paint
// instantly while Shiki spins up in the background.
const createRawTokens = (code: string): TokenizedCode => ({
  bg: "transparent",
  fg: "inherit",
  tokens: code.split("\n").map((line) =>
    line === "" ? [] : [{ color: "inherit", content: line } as ThemedToken],
  ),
});

const highlightCode = (
  code: string,
  language: BundledLanguage,
  callback?: (result: TokenizedCode) => void,
): TokenizedCode | null => {
  const key = getTokensCacheKey(code, language);
  const cached = tokensCache.get(key);
  if (cached) return cached;

  if (callback) {
    if (!subscribers.has(key)) subscribers.set(key, new Set());
    subscribers.get(key)?.add(callback);
  }

  getHighlighter(language)
    .then((highlighter) => {
      const langs = highlighter.getLoadedLanguages();
      const langToUse = (langs.includes(language) ? language : "text") as BundledLanguage;
      const result = highlighter.codeToTokens(code, {
        lang: langToUse,
        themes: { dark: "github-dark", light: "github-light" },
      });
      const tokenized: TokenizedCode = {
        bg: result.bg ?? "transparent",
        fg: result.fg ?? "inherit",
        tokens: result.tokens,
      };
      tokensCache.set(key, tokenized);
      const subs = subscribers.get(key);
      if (subs) {
        for (const sub of subs) sub(tokenized);
        subscribers.delete(key);
      }
    })
    .catch((error) => {
      console.error("Failed to highlight code:", error);
      subscribers.delete(key);
    });

  return null;
};

const CodeBlockBody = memo(
  ({ tokenized }: { tokenized: TokenizedCode }) => {
    const preStyle = useMemo(
      () => ({ backgroundColor: tokenized.bg, color: tokenized.fg }),
      [tokenized.bg, tokenized.fg],
    );
    const keyedLines = useMemo(
      () => addKeysToTokens(tokenized.tokens),
      [tokenized.tokens],
    );
    return (
      <pre
        className="dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)] m-0 overflow-auto p-4 text-[13px] leading-relaxed"
        style={preStyle}
      >
        <code className="font-mono">
          {keyedLines.map((kl) => (
            <LineSpan key={kl.key} keyedLine={kl} />
          ))}
        </code>
      </pre>
    );
  },
  (prev, next) => prev.tokenized === next.tokenized,
);
CodeBlockBody.displayName = "CodeBlockBody";

export type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: BundledLanguage;
};

// Composable code block. Wrap with `<CodeBlockHeader>` for filename / actions.
export const CodeBlock = ({
  code,
  language,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const ctx = useMemo(() => ({ code }), [code]);
  return (
    <CodeBlockContext.Provider value={ctx}>
      <div
        className={cn(
          "group relative w-full overflow-hidden rounded-md border bg-background text-foreground",
          className,
        )}
        data-language={language}
        style={{ containIntrinsicSize: "auto 200px", contentVisibility: "auto" }}
        {...props}
      >
        {children}
        <CodeBlockContent code={code} language={language} />
      </div>
    </CodeBlockContext.Provider>
  );
};

// Inner render: cache lookup → raw fallback → async upgrade once Shiki resolves.
const CodeBlockContent = ({
  code,
  language,
}: {
  code: string;
  language: BundledLanguage;
}) => {
  const rawTokens = useMemo(() => createRawTokens(code), [code]);
  const syncTokens = useMemo(
    () => highlightCode(code, language) ?? rawTokens,
    [code, language, rawTokens],
  );
  const [asyncTokens, setAsyncTokens] = useState<TokenizedCode | null>(null);
  const asyncKeyRef = useRef({ code, language });

  if (
    asyncKeyRef.current.code !== code ||
    asyncKeyRef.current.language !== language
  ) {
    asyncKeyRef.current = { code, language };
    setAsyncTokens(null);
  }

  useEffect(() => {
    let cancelled = false;
    highlightCode(code, language, (result) => {
      if (!cancelled) setAsyncTokens(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  return <CodeBlockBody tokenized={asyncTokens ?? syncTokens} />;
};

export type CodeBlockHeaderProps = HTMLAttributes<HTMLDivElement>;

export const CodeBlockHeader = ({
  className,
  children,
  ...props
}: CodeBlockHeaderProps) => (
  <div
    className={cn(
      "flex items-center justify-between border-b bg-muted/80 px-3 py-1.5 text-muted-foreground text-xs",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const CodeBlockTitle = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

export const CodeBlockFilename = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("font-mono", className)} {...props}>
    {children}
  </span>
);

export const CodeBlockActions = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("-my-1 -mr-1 flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

// Reads the wrapper's `code` from context and copies on click. Shows a check
// icon for `timeout` ms after a successful copy.
export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number>(0);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = useCallback(async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }
    try {
      if (!isCopied) {
        await navigator.clipboard.writeText(code);
        setIsCopied(true);
        onCopy?.();
        timeoutRef.current = window.setTimeout(() => setIsCopied(false), timeout);
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [code, onCopy, onError, timeout, isCopied]);

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const Icon = isCopied ? CheckIcon : CopyIcon;
  return (
    <Button
      className={cn("h-6 w-6 shrink-0", className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      type="button"
      {...props}
    >
      {children ?? <Icon className="h-3.5 w-3.5" />}
    </Button>
  );
};

// ---------- Language selector ----------
// For multi-variant code blocks (the parent owns the `value`/`onValueChange`
// state and re-renders <CodeBlock> with the selected language + matching code).

export type CodeBlockLanguageSelectorProps = ComponentProps<typeof Select>;

export const CodeBlockLanguageSelector = (
  props: CodeBlockLanguageSelectorProps,
) => <Select {...props} />;

export type CodeBlockLanguageSelectorTriggerProps = ComponentProps<
  typeof SelectTrigger
>;

export const CodeBlockLanguageSelectorTrigger = ({
  className,
  ...props
}: CodeBlockLanguageSelectorTriggerProps) => (
  <SelectTrigger
    size="sm"
    className={cn("border-none bg-transparent shadow-none", className)}
    {...props}
  />
);

export type CodeBlockLanguageSelectorValueProps = ComponentProps<typeof SelectValue>;

export const CodeBlockLanguageSelectorValue = (
  props: CodeBlockLanguageSelectorValueProps,
) => <SelectValue {...props} />;

export type CodeBlockLanguageSelectorContentProps = ComponentProps<
  typeof SelectContent
>;

export const CodeBlockLanguageSelectorContent = ({
  align = "end",
  ...props
}: CodeBlockLanguageSelectorContentProps) => (
  <SelectContent align={align} {...props} />
);

export type CodeBlockLanguageSelectorItemProps = ComponentProps<typeof SelectItem>;

export const CodeBlockLanguageSelectorItem = (
  props: CodeBlockLanguageSelectorItemProps,
) => <SelectItem {...props} />;
