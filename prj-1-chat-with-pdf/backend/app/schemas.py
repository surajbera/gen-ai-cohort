from pydantic import BaseModel


class PdfOut(BaseModel):
    """Public-facing PDF record returned by the API."""

    id: str
    filename: str
    status: str
    chunk_count: int
    # Indexing progress, 0..100. Only meaningful while `status == 'indexing'`;
    # always 100 once status is 'ready'.
    progress: int = 0
    error_message: str | None = None
    created_at: str


class MessageOut(BaseModel):
    """A single chat turn."""

    id: int
    role: str
    content: str
    created_at: str


class ChatRequest(BaseModel):
    """Body of a chat request — just the user's new message."""

    message: str
