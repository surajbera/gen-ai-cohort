from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routers import chat, pdfs


app = FastAPI(title="Chat with PDF")

# Single-user local dev — wide-open CORS is fine here
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    """Creates SQLite tables before serving the first request."""
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe — returns ok when the API is up."""
    return {"status": "ok"}


app.include_router(pdfs.router)
app.include_router(chat.router)

# /Users/username/Desktop/folder-name/gen-ai-cohort/prj-1-chat-with-pdf/backend/.venv/bin/python

""" 
docker compose down -v
rm -rf prj-1-chat-with-pdf/backend/data/* 2>/dev/null
docker compose up --build --renew-anon-volumes
"""

"""  
cd prj-1-chat-with-pdf

cp .env.example .env             # then add OPENAI_API_KEY

docker compose up --build --renew-anon-volumes    # runs the whole app

# (optional, for editor support only)
cd frontend && npm install && cd ..
cd backend  && uv sync       && cd ..
"""