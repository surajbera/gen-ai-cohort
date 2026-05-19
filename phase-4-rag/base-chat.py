# QUERY: user question -> embed -> Qdrant similarity search -> chunks.

import json
from pathlib import Path
from dotenv import load_dotenv

# langchain_qdrant / QdrantVectorStore: LangChain wrapper around Qdrant.
from langchain_qdrant import QdrantVectorStore

# langchain_openai / OpenAIEmbeddings: embedding client.
# Must match the model used in main.py (same dimensions, same vector space).
from langchain_openai import OpenAIEmbeddings

load_dotenv()

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

print(f"search_results => {search_results}")

# Dump results to a JSON file we can open in the IDE as a collapsible tree.
output_path = Path(__file__).parent / "search_results.json"

output_path.write_text(
  json.dumps(
    [{"page_content": d.page_content, "metadata": d.metadata} for d in search_results],
    indent=2,
    ensure_ascii=False,
  )
)
print(f"Saved {len(search_results)} results to: {output_path}")

# Quick terminal summary (one line per result).
for i, doc in enumerate(search_results, 1):
    print(f"  {i}. page {doc.metadata['page_label']:>3} — {doc.page_content[:80]}...")