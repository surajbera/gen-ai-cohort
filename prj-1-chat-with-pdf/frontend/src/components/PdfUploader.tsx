import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadPdf } from "@/lib/api";

type Props = {
  // Called after a successful upload so the parent can refresh its PDF list.
  onUploaded: () => void;
};

// File picker that uploads a PDF to the backend and reports completion.
export function PdfUploader({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reads the chosen file and posts it; surfaces any backend error inline.
  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadPdf(file);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handlePick}
      />
      <Button
        className="h-8 w-full text-xs lg:h-9 lg:text-sm"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin lg:h-4 lg:w-4" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
            Upload PDF
          </>
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
