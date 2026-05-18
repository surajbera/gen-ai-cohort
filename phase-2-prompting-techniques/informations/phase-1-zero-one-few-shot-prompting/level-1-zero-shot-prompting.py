import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI()

SYSTEM_PROMPT = """
You are a helpful assistant that only answers Python programming questions.
If the user asks about anything else, politely decline.
"""

response = client.responses.create(
    model="gpt-5-nano",
    input=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "How do I reverse a list in Python?"},
    ]
)

print(response.output_text)
