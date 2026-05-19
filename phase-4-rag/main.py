# INDEXING: PDF -> chunks -> embeddings -> Qdrant. Run once(this is important).

from dotenv import load_dotenv
from pathlib import Path

# langchain_community: third-party LangChain integrations.
# PyPDFLoader: reads a PDF into one Document per page (text + metadata).
from langchain_community.document_loaders import PyPDFLoader

# langchain_text_splitters: utilities to chop long text into smaller chunks.
# RecursiveCharacterTextSplitter: splits on paragraphs, sentences, words, chars.
from langchain_text_splitters import RecursiveCharacterTextSplitter

# langchain_openai: official OpenAI integration.
# OpenAIEmbeddings: turns text into fixed-size numeric vectors.
from langchain_openai import OpenAIEmbeddings

# langchain_qdrant: Qdrant vector DB integration.
# QdrantVectorStore: LangChain-friendly wrapper around the Qdrant client.
from langchain_qdrant import QdrantVectorStore

load_dotenv()

pdf_path = Path(__file__).parent / "web_development_basics.pdf"
loader = PyPDFLoader(file_path=pdf_path)

# step 1: read pdf -> list of Documents (one per page).
docs = loader.load()

# step 2: chunking. ~1000 chars/chunk with 200 chars of overlap so context
# isn't lost at chunk boundaries.
text_splitter = RecursiveCharacterTextSplitter(
  chunk_size = 1000,
  chunk_overlap = 200
)
split_docs = text_splitter.split_documents(documents=docs)

# step 3: embedding model client (no API call yet, just config).
# text-embedding-3-small -> 1536-dim vectors, cheap and fast.
embedding_model = OpenAIEmbeddings(
  model="text-embedding-3-small"
)

# from_documents does 3 things in one call:
#   1. connect to Qdrant
#   2. create the collection if missing (auto-detects vector size)
#   3. embed each chunk and insert it as a point
# Re-running this script duplicates data (no dedupe).
vector_store = QdrantVectorStore.from_documents(
  documents=split_docs,
  url="http://localhost:6333",
  collection_name="learning_vectors",
  embedding=embedding_model
)

print("Indexing of documents done!")
