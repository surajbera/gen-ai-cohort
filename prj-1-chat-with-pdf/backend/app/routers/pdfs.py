import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from app.config import settings
from app.db import connect
from app.schemas import PdfOut
from app.services.indexing import (
    collection_name_for,
    drop_collection,
    hash_bytes,
    index_pdf,
)


router = APIRouter(prefix="/api/pdfs", tags=["pdfs"])


def _row_to_pdf(row) -> PdfOut:
    """Converts a sqlite Row to the public PdfOut schema."""
    return PdfOut(
        id=row["id"],
        filename=row["filename"],
        status=row["status"],
        chunk_count=row["chunk_count"],
        progress=row["progress"] if "progress" in row.keys() else 0,
        error_message=row["error_message"],
        created_at=row["created_at"],
    )


@router.get("", response_model=list[PdfOut])
def list_pdfs() -> list[PdfOut]:
    """Returns all uploaded PDFs, newest first."""
    with connect() as conn:
        rows = conn.execute("SELECT * FROM pdfs ORDER BY created_at DESC").fetchall()
    return [_row_to_pdf(r) for r in rows]


@router.get("/{pdf_id}", response_model=PdfOut)
def get_pdf(pdf_id: str) -> PdfOut:
    """Returns a single PDF row — used by the UI to poll indexing status."""
    with connect() as conn:
        row = conn.execute("SELECT * FROM pdfs WHERE id=?", (pdf_id,)).fetchone()
    if not row:
        raise HTTPException(404, "PDF not found")
    return _row_to_pdf(row)


@router.post("", response_model=PdfOut, status_code=201)
async def upload_pdf(
    background: BackgroundTasks, file: UploadFile = File(...)
) -> PdfOut:
    """Accepts a PDF upload, dedupes by sha256, and kicks off indexing in the background.
    Returns immediately so the UI can poll for status."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only .pdf files are allowed")

    data = await file.read()
    file_hash = hash_bytes(data)

    with connect() as conn:
        existing = conn.execute(
            "SELECT * FROM pdfs WHERE file_hash=?", (file_hash,)
        ).fetchone()
        if existing:
            return _row_to_pdf(existing)

        pdf_id = str(uuid.uuid4())
        file_path: Path = settings.uploads_dir / f"{pdf_id}.pdf"
        file_path.write_bytes(data)

        conn.execute(
            """
            INSERT INTO pdfs (id, filename, file_hash, file_path, collection_name, status)
            VALUES (?, ?, ?, ?, ?, 'indexing')
            """,
            (
                pdf_id,
                file.filename,
                file_hash,
                str(file_path),
                collection_name_for(pdf_id),
            ),
        )
        row = conn.execute("SELECT * FROM pdfs WHERE id=?", (pdf_id,)).fetchone()

    background.add_task(index_pdf, pdf_id, file_path)
    return _row_to_pdf(row)


@router.delete("/{pdf_id}", status_code=204)
def delete_pdf(pdf_id: str) -> None:
    """Removes the PDF row, its chat history, the original file, and the Qdrant collection."""
    with connect() as conn:
        row = conn.execute("SELECT * FROM pdfs WHERE id=?", (pdf_id,)).fetchone()
        if not row:
            raise HTTPException(404, "PDF not found")
        conn.execute("DELETE FROM pdfs WHERE id=?", (pdf_id,))

    drop_collection(row["collection_name"])
    Path(row["file_path"]).unlink(missing_ok=True)
