import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI()

SYSTEM_PROMPT = """
You are a helpful assistant. You only help with Python programming questions and nothing else.
If user tried to ask you about something else, you should politely decline and say you only help
with Python programming questions.
"""

response = client.responses.create(
    model="gpt-5-nano",
    input=[
        {"role": "system", "content": SYSTEM_PROMPT},

        {"role": "user", "content": "What is the capital of France?"},
        {"role": "assistant", "content": "I'm sorry, I can only help with Python programming questions."},

        {"role": "user", "content": "How do I reverse a list in Python?"},
    ]
)

print(response.output_text)
