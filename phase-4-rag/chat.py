# QUERY: user question -> embed -> Qdrant similarity search -> chunks.

import json
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

# langchain_qdrant / QdrantVectorStore: LangChain wrapper around Qdrant.
from langchain_qdrant import QdrantVectorStore

# langchain_openai / OpenAIEmbeddings: embedding client.
# Must match the model used in main.py (same dimensions, same vector space).
from langchain_openai import OpenAIEmbeddings

load_dotenv()

client = OpenAI()

embedding_model = OpenAIEmbeddings(
  model="text-embedding-3-small"
)

# from_existing_collection: attach to a collection that main.py already
# populated. Read-only — doesn't recreate or modify the data.
vector_db = QdrantVectorStore.from_existing_collection(
  url="http://localhost:6333",
  collection_name="learning_vectors",
  embedding=embedding_model
)

query = input("User query for the pdf: ")

# similarity_search:
#   1. embed the query with the same model used at indexing time
#   2. find the closest stored vectors in Qdrant (cosine, default k=4)
#   3. return matching chunks as Document objects (page_content + metadata)
search_results = vector_db.similarity_search(
  query=query
)

# Save the full raw results (with all metadata) for debugging in the IDE.
output_path = Path(__file__).parent / "search_results.json"
output_path.write_text(
  json.dumps(
    [{"page_content": d.page_content, "metadata": d.metadata} for d in search_results],
    indent=2,
    ensure_ascii=False,
  )
)

# Build a slim, citation-friendly context for the LLM:
# only what it needs (page number + chunk text), no PDF metadata noise.
context = json.dumps(
  [
    {"page": d.metadata.get("page_label"), "content": d.page_content}
    for d in search_results
  ],
  indent=2,
  ensure_ascii=False,
)

SYSTEM_PROMPT = f"""
You are a helpful assistant that answers questions strictly using the
context below, which is a list of chunks taken from a PDF. Each chunk has
a `page` number (where it appears in the PDF) and `content` (the chunk text).

Rules:
- Only answer using information found in the context. If the answer isn't
  there, say "I couldn't find this in the PDF."
- After your answer, list the page number(s) you used, like:
    "Source: page 41" or "Sources: pages 37, 41"
- Do not invent page numbers. Use only the ones present in the context.

Context:
{context}
"""

chat_completion = client.chat.completions.create(
  model="gpt-5-nano",
  messages=[
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "user", "content": query}
  ]
)

print(f"\nResults from PDF =>\n{chat_completion.choices[0].message.content}")