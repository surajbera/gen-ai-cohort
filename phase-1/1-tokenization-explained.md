# Understanding Tokenization (via Tiktokenizer)

## Tokenization is a Two-Stage Process

Tokenization is the process of converting **text → tokens → numbers (token IDs)**. The screenshot from [Tiktokenizer](https://tiktokenizer.vercel.app/) perfectly demonstrates this.

**One-liner definition:** breaking text into subword pieces and mapping each to a unique integer ID from the model's vocabulary.

```
"hello all" → ["hello", " all"] → [22172, 599]
```

---

## What the Screenshot Shows

**Input text:** `hello all`
**Model used:** `codellama/CodeLlama-7b-hf`

### Stage 1 — Text → Tokens (subword units)

The tokenizer splits the text into **2 tokens**:

- `hello` (highlighted in blue)
- ` all` (highlighted in yellow, including the leading space)

### Stage 2 — Tokens → Numbers (token IDs)

Each token is mapped to a unique integer ID from the model's vocabulary:

| Token   | Token ID |
| ------- | -------- |
| `hello` | 22172    |
| ` all`  | 599      |

---

## The Full Pipeline

```
"hello all"  →  ["hello", " all"]  →  [22172, 599]
   (text)         (tokens)            (token IDs / numbers)
```

---

## Why This Matters

Neural networks (LLMs) **cannot process raw text** — they only work with numbers (tensors). Tokenization is essential because:

1. **Splitting into tokens** — Text is broken into meaningful subword pieces using algorithms like:
   - Byte-Pair Encoding (**BPE**)
   - **WordPiece**
   - **SentencePiece**

   This balances vocabulary size with the ability to represent any word.

2. **Mapping to integers** — Each token has a fixed ID in the model's vocabulary lookup table. These IDs are then converted into **embedding vectors** inside the model.

---

## Clarifying: Vocabulary vs. Embeddings

A common point of confusion is assuming the model's vocabulary already stores embedding vectors. It doesn't. The vocabulary and the embedding matrix are **two separate components**.

| Component              | What it stores                          | Form                                                                |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| **Vocabulary**         | `token string → integer ID`             | A dictionary, e.g. `{"hello": 22172, " all": 599, ...}`             |
| **Embedding matrix**   | `integer ID → vector of floats`         | A matrix of shape `[vocab_size, embedding_dim]` (e.g. `[32000, 4096]`) |

### Where embeddings actually come from

- **Training data** = the raw text corpus the model was trained on (books, web pages, code, etc.). It contains **no embeddings** — just text.
- **Embeddings** = numerical vectors the model **learned during training** and stored in the embedding matrix, which is part of the model's parameters/weights.

So embeddings are not "in the training data" — they live in the trained model's weights. When you download a model like LLaMA-7B, the `.safetensors` / `.bin` files include this embedding matrix as one of the parameter tensors.

### What "converted into embedding vectors" really means

It's a row lookup in the embedding matrix:

```
token ID = 22172
       ↓ (used as a row index)
embedding_matrix[22172]  →  [0.0123, -0.4567, 0.789, ..., 0.0021]
```

### End-to-end flow

```
"hello all"
   ↓ tokenizer (uses vocabulary: text → ID)
[22172, 599]
   ↓ embedding lookup (uses embedding matrix: ID → vector)
[[0.01, -0.45,  0.78, ...],   ← vector for 22172
 [0.22,  0.11, -0.03, ...]]   ← vector for 599
   ↓ transformer layers
... rest of the model ...
```

---

## Important Nuances

- **Different models = different tokenizers.** GPT-4, LLaMA, and BERT will produce different tokens *and* different IDs for the same input.
- **Tokens ≠ words.** A single word can be multiple tokens (e.g., `"tokenization"` might split into `token` + `ization`).
- **Spaces matter.** Spaces are often part of tokens (notice ` all` includes the leading space).
- **Token count affects:**
  - API costs
  - Context window limits
  - Inference speed

---

## Key Takeaway

> **Tokenization = Text → Tokens → Numbers (IDs)**

This conversion is the very first step in any LLM pipeline, enabling the model to understand and process human language as numerical data.

---

## Try It Yourself

Curious how your own text breaks down into tokens and token IDs? Check out this interactive tool: [tiktokenizer.vercel.app](https://tiktokenizer.vercel.app/)
