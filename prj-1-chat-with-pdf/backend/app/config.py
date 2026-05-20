from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Reads env vars (and optional .env) into a typed config object."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str
    qdrant_url: str = "http://qdrant:6333"
    model_chat: str = "gpt-5-nano"
    model_embed: str = "text-embedding-3-small"
    # Indexing knobs. Larger chunks preserve code blocks and multi-paragraph
    # answers better; the trade-off is fewer, fatter retrievals per query.
    # 1500 / 300 is a good default for technical / code-heavy PDFs.
    chunk_size: int = 1500
    chunk_overlap: int = 300

    # How many chunks to pull from Qdrant per query. Higher = more chance the
    # full code/answer is present, at the cost of more input tokens per turn.
    retrieval_k: int = 8

    # How many prior messages (user + assistant turns) are replayed to the LLM
    # as context on each new turn. Higher = better continuity, but every turn
    # also re-injects the retrieval context, so cost grows roughly linearly
    # with this value. 6 is a sensible default for single-user dev.
    history_window: int = 6

    data_dir: Path = Path("/app/data")

    @property
    def db_path(self) -> Path:
        return self.data_dir / "app.db"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"


# Single shared instance, imported everywhere
settings = Settings()  # type: ignore[call-arg]
settings.uploads_dir.mkdir(parents=True, exist_ok=True)
