# Prompting Techniques

## The "shot" terminology

A **shot** is an example of input → desired output included in the prompt. The number of shots refers to how many examples you provide *before* the real query.

| Term | Examples Provided |
|------|-------------------|
| Zero-shot | None — just instructions |
| One-shot | 1 example |
| Few-shot | 2 or more examples |

The "shot" count has nothing to do with where instructions live (system vs user). It's purely about whether you **demonstrate** the task with examples or just **describe** it.

---

## Zero-shot prompting

Describe the task in natural language. No examples. The model relies on its training to figure out how to do it.

```python
input=[
    {"role": "system", "content": "You are a helpful assistant. You only answer Python questions."},
    {"role": "user", "content": "How do I reverse a list in Python?"},
]
```

**Use when:** the task is clear and well-known to the model (translation, summarization, common Q&A).

---

## Few-shot prompting

Add fabricated example exchanges *before* the real query so the model sees the pattern you want.

```python
input=[
    {"role": "system", "content": "You only answer Python questions; politely refuse otherwise."},

    {"role": "user", "content": "What's the capital of France?"},
    {"role": "assistant", "content": "Sorry, I can only help with Python programming questions."},

    {"role": "user", "content": "Who won the World Cup in 2022?"},
    {"role": "assistant", "content": "Sorry, I can only help with Python programming questions."},

    {"role": "user", "content": "How do I reverse a list in Python?"},
    {"role": "assistant", "content": "Use `my_list[::-1]` or `my_list.reverse()`."},

    {"role": "user", "content": "How to code a binary tree in Python?"},
]
```

**Use when:**
- Output format matters (specific JSON shape, tone, structure)
- Task is fuzzy or domain-specific
- Zero-shot keeps getting it wrong

---

## Common misconception

> "Putting the instruction in the system prompt = zero-shot prompting."

Not quite. The system prompt is good practice in **all** prompting styles. What makes a prompt zero-shot is the **absence of examples**, not the location of the instruction.

---

## Quick mental model

- **Zero-shot:** "Classify this email as spam or not spam: ..."
- **Few-shot:** "Here are 3 examples of spam vs not spam → now classify this one: ..."
