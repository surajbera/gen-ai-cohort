from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.db import connect
from app.schemas import ChatRequest, MessageOut
from app.services.chat import stream_answer


router = APIRouter(prefix="/api/pdfs/{pdf_id}", tags=["chat"])


@router.get("/messages", response_model=list[MessageOut])
def list_messages(pdf_id: str) -> list[MessageOut]:
    """Returns the full chat history for a PDF, oldest first."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM messages WHERE pdf_id=? ORDER BY id ASC", (pdf_id,)
        ).fetchall()
    return [
        MessageOut(id=r["id"], role=r["role"], content=r["content"], created_at=r["created_at"])
        for r in rows
    ]


@router.post("/chat")
async def chat(pdf_id: str, body: ChatRequest):
    """Streams a chat turn as NDJSON events.

    Wire format:
      - Media type: ``application/x-ndjson``. One JSON object per line, each
        terminated by ``\\n``. Frontend splits on ``\\n`` and ``JSON.parse``s
        each line.
      - Event types:
          * ``{"type":"status","text":"..."}``  -- progress narration
          * ``{"type":"sources","pages":[...],"chunks":N}``
          * ``{"type":"token","text":"..."}``   -- one per LLM delta
      - Order is the generation order; HTTP/1.1 chunked transfer preserves it.

    Why NDJSON over plain text or SSE:
      - Plain text can't multiplex status + tokens cleanly.
      - SSE works but ``EventSource`` can't POST and adds framing overhead;
        NDJSON over ``fetch`` is simpler for one-way server-push.

    Lifecycle:
      - 404 if the PDF doesn't exist; 409 if it's still indexing or failed.
      - User + assistant turns are persisted to SQLite ONLY after the stream
        finishes cleanly. If the client disconnects mid-stream, neither row
        is inserted -- partial replies never end up in history.
    """
    with connect() as conn:
        row = conn.execute("SELECT status FROM pdfs WHERE id=?", (pdf_id,)).fetchone()
    if not row:
        raise HTTPException(404, "PDF not found")
    if row["status"] != "ready":
        raise HTTPException(409, f"PDF is not ready (status={row['status']})")

    return StreamingResponse(
        stream_answer(pdf_id, body.message),
        media_type="application/x-ndjson",
    )
