import hashlib
from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from qdrant_client import QdrantClient

from app.config import settings
from app.db import connect


def hash_bytes(data: bytes) -> str:
    """Returns sha256 hex digest of `data` — used to dedupe identical PDFs."""
    return hashlib.sha256(data).hexdigest()


def collection_name_for(pdf_id: str) -> str:
    """Maps a pdf_id to its dedicated Qdrant collection name."""
    return f"pdf_{pdf_id.replace('-', '')}"


def _embeddings() -> OpenAIEmbeddings:
    """Builds the embedding client — same model used at index and query time."""
    return OpenAIEmbeddings(
        model=settings.model_embed,
        api_key=settings.openai_api_key,
    )


# How many chunks to embed + upsert per Qdrant call. Smaller = smoother
# progress bar updates and more frequent SQLite writes; larger = fewer round
# trips to OpenAI/Qdrant. 16 is a comfortable middle ground for typical PDFs.
_BATCH_SIZE = 16


def _set_progress(pdf_id: str, progress: int) -> None:
    """Writes a 0..100 progress value for the indexing row."""
    progress = max(0, min(100, int(progress)))
    with connect() as conn:
        conn.execute("UPDATE pdfs SET progress=? WHERE id=?", (progress, pdf_id))


def index_pdf(pdf_id: str, file_path: Path) -> None:
    """Chunks the PDF at `file_path` and writes embeddings to a fresh Qdrant
    collection. Updates the SQLite row's status to 'ready' or 'failed'.

    Embedding + upserting is done in batches so we can write incremental
    progress (0..100) to SQLite, which the UI polls."""
    try:
        _set_progress(pdf_id, 0)

        loader = PyPDFLoader(file_path=str(file_path))
        docs = loader.load()

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        chunks = splitter.split_documents(docs)

        # attach pdf_id so chunks remain traceable inside Qdrant
        for c in chunks:
            c.metadata["pdf_id"] = pdf_id

        total = len(chunks)
        collection = collection_name_for(pdf_id)

        if total == 0:
            raise ValueError("No extractable text in PDF")

        # First batch creates the collection (sized to the embedding dim);
        # subsequent batches reuse the existing one.
        first = chunks[:_BATCH_SIZE]
        store = QdrantVectorStore.from_documents(
            documents=first,
            url=settings.qdrant_url,
            collection_name=collection,
            embedding=_embeddings(),
        )
        done = len(first)
        _set_progress(pdf_id, int(done * 100 / total))

        for start in range(_BATCH_SIZE, total, _BATCH_SIZE):
            batch = chunks[start : start + _BATCH_SIZE]
            store.add_documents(batch)
            done += len(batch)
            _set_progress(pdf_id, int(done * 100 / total))

        with connect() as conn:
            conn.execute(
                "UPDATE pdfs SET status='ready', chunk_count=?, progress=100 WHERE id=?",
                (total, pdf_id),
            )
    except Exception as e:  # noqa: BLE001
        with connect() as conn:
            conn.execute(
                "UPDATE pdfs SET status='failed', error_message=? WHERE id=?",
                (str(e), pdf_id),
            )


def drop_collection(collection: str) -> None:
    """Best-effort delete of a Qdrant collection — silent on missing."""
    client = QdrantClient(url=settings.qdrant_url)
    try:
        client.delete_collection(collection_name=collection)
    except Exception:
        pass


def get_vector_store(collection: str) -> QdrantVectorStore:
    """Attaches read-only to an existing Qdrant collection for similarity search."""
    return QdrantVectorStore.from_existing_collection(
        url=settings.qdrant_url,
        collection_name=collection,
        embedding=_embeddings(),
    )
