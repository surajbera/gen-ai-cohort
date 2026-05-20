import { useEffect, useMemo, useState } from "react";
import { PdfList } from "@/components/PdfList";
import { PdfUploader } from "@/components/PdfUploader";
import { ChatPanel } from "@/components/ChatPanel";
import { deletePdf, listPdfs, type Pdf } from "@/lib/api";

// Top-level layout: sidebar (uploader + list) on the left, chat panel on the right.
// Polls the PDF list while any PDF is still indexing so the UI flips to "ready".
export default function App() {
  const [pdfs, setPdfs] = useState<Pdf[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Refreshes the PDF list from the backend.
  async function refresh() {
    const next = await listPdfs();
    setPdfs(next);
    if (!next.find((p) => p.id === selectedId)) {
      setSelectedId(next[0]?.id ?? null);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const anyIndexing = useMemo(() => pdfs.some((p) => p.status === "indexing"), [pdfs]);

  // Poll every 2s while indexing is in progress.
  useEffect(() => {
    if (!anyIndexing) return;
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [anyIndexing]);

  // Removes a PDF on the backend and updates local state.
  async function handleDelete(id: string) {
    await deletePdf(id);
    if (selectedId === id) setSelectedId(null);
    refresh();
  }

  const selected = pdfs.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="grid h-screen overflow-hidden grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">
      <aside className="flex min-h-0 min-w-0 flex-col gap-3 border-r p-3 lg:gap-4 lg:p-4">
        <div>
          <h1 className="text-sm font-semibold lg:text-base">Chat with PDF</h1>
          <p className="text-[11px] text-muted-foreground lg:text-xs">
            Upload a PDF, then ask questions about it.
          </p>
        </div>
        <PdfUploader onUploaded={refresh} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PdfList
            pdfs={pdfs}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={handleDelete}
          />
        </div>
      </aside>

      <main className="min-h-0 min-w-0 overflow-hidden">
        {selected ? (
          <ChatPanel key={selected.id} pdf={selected} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a PDF on the left to start chatting.
          </div>
        )}
      </main>
    </div>
  );
}
