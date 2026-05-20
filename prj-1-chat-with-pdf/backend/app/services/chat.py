import json
from typing import AsyncIterator

from openai import AsyncOpenAI

from app.config import settings
from app.db import connect
from app.services.indexing import collection_name_for, get_vector_store


_client = AsyncOpenAI(api_key=settings.openai_api_key)


# --- Query rewriting ---------------------------------------------------------
# The user's raw message often doesn't make sense in isolation (e.g. "show the
# full code"). Embedding that string and doing similarity search returns junk
# because the query has no semantic overlap with the actual topic.
#
# So before retrieval, we ask the LLM to rewrite the message into a STANDALONE
# search query using the chat history. This is cheap (~50-100 tokens with
# gpt-5-nano) and dramatically improves follow-up turns.

REWRITE_SYSTEM = """You rewrite a user's latest chat message into a single \
standalone search query for a PDF retrieval system. The query must be \
self-contained: a reader without the chat history should understand exactly \
what to look for.

Rules:
- If the latest message is already a complete, specific question, return it unchanged.
- For follow-ups like "show the full code", "explain more", "give an example", \
incorporate the topic from prior turns.
- Output ONLY the rewritten query. No quotes, no preamble, no trailing punctuation."""


async def _rewrite_query(user_message: str, history: list[dict]) -> str:
    """Returns a standalone search query derived from the user message + history."""
    if not history:
        return user_message
    history_text = "\n".join(f"{m['role']}: {m['content']}" for m in history[-4:])
    resp = await _client.chat.completions.create(
        model=settings.model_chat,
        messages=[
            {"role": "system", "content": REWRITE_SYSTEM},
            {
                "role": "user",
                "content": f"History:\n{history_text}\n\nLatest message: {user_message}",
            },
        ],
    )
    rewritten = (resp.choices[0].message.content or "").strip()
    return rewritten or user_message


# --- Answer generation -------------------------------------------------------
# Stronger prompt: forces verbatim code reproduction in fenced blocks, tells
# the model to stitch adjacent chunks together, and bans "this is just an
# excerpt" type apologies that confuse the user.

ANSWER_SYSTEM_TMPL = """You are a helpful assistant for a PDF titled \
"{filename}". Use ONLY the context below (a list of chunks; each has a `page` \
number and `content`) to answer the user's question.

CONVERSATIONAL BEHAVIOR:
- For greetings ("hi", "hello", "hey", "thanks") or meta questions ("what \
can you do", "what is this PDF about"), respond briefly and warmly, mention \
that you're ready to answer questions about "{filename}", and suggest the \
user ask something specific. Skip the page citation for these turns. Do NOT \
say "I couldn't find this in the PDF" for a greeting.

ANSWER RULES (for actual content questions):
1. When code appears in the context, reproduce it VERBATIM inside a fenced \
markdown code block with the right language tag (```js, ```ts, ```python, \
```sql, etc.). Preserve indentation and line breaks. Never paraphrase code.
2. If code is split across adjacent chunks (same page or consecutive pages, \
same topic), STITCH them together into one continuous code block. Do NOT say \
"the rest isn't shown" or "this is just an excerpt" -- assemble the full picture.
3. Use markdown formatting (headings, bullet lists, **bold**) for readability.
4. End your answer with the page citation(s): `Source: page 40` or \
`Sources: pages 40, 41, 42`. Use only page numbers actually present in the context.
5. If the answer truly isn't in the context for a real question, reply exactly: \
"I couldn't find this in the PDF." Do NOT invent.

Context:
{context}"""


def _get_filename(pdf_id: str) -> str:
    """Returns the original filename for a PDF (used to personalize the prompt)."""
    with connect() as conn:
        row = conn.execute("SELECT filename FROM pdfs WHERE id=?", (pdf_id,)).fetchone()
    return row["filename"] if row else "this PDF"


def _retrieve(query: str, collection: str, k: int) -> list:
    """Runs similarity search and returns the matched LangChain Documents."""
    store = get_vector_store(collection)
    return store.similarity_search(query=query, k=k)


def _build_context(hits) -> str:
    """Serializes retrieved chunks into the JSON shape the system prompt expects."""
    return json.dumps(
        [
            {
                "page": d.metadata.get("page_label") or d.metadata.get("page"),
                "content": d.page_content,
            }
            for d in hits
        ],
        indent=2,
        ensure_ascii=False,
    )


def _recent_history(pdf_id: str, limit: int) -> list[dict]:
    """Returns the last `limit` messages (oldest first) for multi-turn context.

    Cost note: the system prompt above already carries the retrieval context
    for THIS turn, and it gets rebuilt on every call. So the per-turn token
    cost is roughly: retrieval_chunks + (limit messages of history) + new turn.
    Tune `HISTORY_WINDOW` env var if cost is a concern."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE pdf_id=? ORDER BY id DESC LIMIT ?",
            (pdf_id, limit),
        ).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


# --- NDJSON event stream -----------------------------------------------------
# Wire format: one JSON object per line, each terminated by `\n`.
#   {"type":"status",  "text":"Rewriting query..."}
#   {"type":"status",  "text":"Searching for: ..."}
#   {"type":"sources", "pages":[40,41,42]}
#   {"type":"token",   "text":"..."}    (one per LLM delta)
#
# This lets the frontend show a live "thinking" panel for status/sources
# events while still streaming the answer token-by-token.


def _event(**kwargs) -> str:
    """Serializes a single NDJSON event line (with trailing newline)."""
    return json.dumps(kwargs, ensure_ascii=False) + "\n"


async def stream_answer(pdf_id: str, user_message: str) -> AsyncIterator[str]:
    """Yields NDJSON events for a chat turn, then persists both turns to SQLite.

    Pipeline:
      1. Pull recent history from SQLite.
      2. Rewrite the user's message into a standalone retrieval query (LLM call).
      3. similarity_search the PDF's Qdrant collection (k = settings.retrieval_k).
      4. Build the system prompt with the retrieved chunks.
      5. Stream chat completion; emit one `token` event per delta.
      6. Persist user + assistant turns once the stream finishes cleanly. If the
         client disconnects mid-stream, neither row is inserted, so partial
         replies never end up in history.
    """
    history = _recent_history(pdf_id, settings.history_window)

    yield _event(type="status", text="Understanding your question...")
    rewritten = await _rewrite_query(user_message, history)
    if rewritten != user_message:
        yield _event(type="status", text=f'Searching for: "{rewritten}"')
    else:
        yield _event(type="status", text="Searching the PDF...")

    collection = collection_name_for(pdf_id)
    hits = _retrieve(rewritten, collection, settings.retrieval_k)
    pages = sorted(
        {
            d.metadata.get("page_label") or d.metadata.get("page")
            for d in hits
            if d.metadata.get("page_label") or d.metadata.get("page") is not None
        },
        key=lambda p: (str(p)),
    )
    yield _event(type="sources", pages=pages, chunks=len(hits))
    yield _event(type="status", text="Generating answer...")

    context = _build_context(hits)
    filename = _get_filename(pdf_id)
    messages = [
        {
            "role": "system",
            "content": ANSWER_SYSTEM_TMPL.format(filename=filename, context=context),
        },
        *history,
        {"role": "user", "content": user_message},
    ]

    full_reply = ""
    stream = await _client.chat.completions.create(
        model=settings.model_chat,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        if delta:
            full_reply += delta
            yield _event(type="token", text=delta)

    with connect() as conn:
        conn.execute(
            "INSERT INTO messages (pdf_id, role, content) VALUES (?, 'user', ?)",
            (pdf_id, user_message),
        )
        conn.execute(
            "INSERT INTO messages (pdf_id, role, content) VALUES (?, 'assistant', ?)",
            (pdf_id, full_reply),
        )
