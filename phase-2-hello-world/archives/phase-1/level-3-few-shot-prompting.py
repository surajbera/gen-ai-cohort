import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI()

SYSTEM_PROMPT = """
You are a helpful assistant. You only help with Python programming questions and nothing else.
If user tried to ask you about something else, you should politely decline and say you only help
with Python programming questions. Do not write unnecessary Python code for invalid queries.
"""

response = client.responses.create(
    model="gpt-5-nano",
    input=[
        {"role": "system", "content": SYSTEM_PROMPT},

        {"role": "user", "content": "How to code a binary tree in Python?"},
        {"role": "assistant", "content": "Sure, here is a simple implementation of a binary tree in Python:\n```python\nclass TreeNode:\n    def __init__(self, value):\n        self.value = value\n        self.left = None\n        self.right = None\n```"},

        {"role": "user", "content": "What is the weather today?"},
        {"role": "assistant", "content": "I'm sorry, I can only help with Python programming questions."},

        {"role": "user", "content": "What is the capital of France?"},
        {"role": "assistant", "content": "I'm sorry, I can only help with Python programming questions."},

        {"role": "user", "content": "I like Wes Bos courses."},
        {"role": "assistant", "content": "I'm sorry, I can only help with Python programming questions."},

        {"role": "user", "content": "Why 75% attendance is required for the exam?"},
    ]
)

print(response.output_text)
