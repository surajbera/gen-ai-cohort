import { FileText, Trash2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Pdf } from "@/lib/api";

type Props = {
  pdfs: Pdf[];
  selectedId: string | null;
  // Called when the user clicks a PDF in the list.
  onSelect: (id: string) => void;
  // Called when the user clicks the delete icon for a PDF.
  onDelete: (id: string) => void;
};

// Renders a sidebar list of PDFs with status badge, click-to-select, and delete.
export function PdfList({ pdfs, selectedId, onSelect, onDelete }: Props) {
  if (pdfs.length === 0) {
    return (
      <p className="px-2 text-xs text-muted-foreground">
        No PDFs yet. Upload one to get started.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {pdfs.map((pdf) => (
        <li key={pdf.id}>
          <button
            onClick={() => onSelect(pdf.id)}
            className={cn(
              "group flex w-full items-start gap-2 rounded-md border border-transparent p-2 text-left transition-colors hover:bg-accent",
              selectedId === pdf.id && "border-border bg-accent",
            )}
          >
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground lg:h-4 lg:w-4" />
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xs font-medium lg:text-sm"
                title={pdf.filename}
              >
                {pdf.filename}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={pdf.status} progress={pdf.progress} />
                {pdf.status === "ready" && (
                  <span className="text-[9px] text-muted-foreground lg:text-[10px]">
                    {pdf.chunk_count} chunks
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 transition-opacity lg:opacity-0 lg:group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete "${pdf.filename}"?`)) onDelete(pdf.id);
              }}
              aria-label="Delete PDF"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </button>
        </li>
      ))}
    </ul>
  );
}

// Small colored pill that reflects indexing/ready/failed.
// During indexing it also shows the integer progress percentage so the user
// gets feedback on long-running uploads.
function StatusBadge({
  status,
  progress,
}: {
  status: Pdf["status"];
  progress: number;
}) {
  const cls =
    "gap-1 px-1.5 py-0 text-[9px] leading-tight lg:px-2 lg:py-0.5 lg:text-xs";
  if (status === "indexing") {
    const pct = Math.max(0, Math.min(100, Math.round(progress)));
    return (
      <Badge variant="warning" className={cls}>
        <Loader2 className="h-2.5 w-2.5 animate-spin lg:h-3 lg:w-3" />
        Indexing {pct}%
      </Badge>
    );
  }
  if (status === "failed")
    return (
      <Badge variant="destructive" className={cls}>
        <AlertCircle className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
        Failed
      </Badge>
    );
  return (
    <Badge variant="success" className={cls}>
      <CheckCircle2 className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
      Ready
    </Badge>
  );
}
