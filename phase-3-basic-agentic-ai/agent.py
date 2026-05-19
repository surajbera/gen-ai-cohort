import json

from dotenv import load_dotenv
from openai import OpenAI

from prompts import SYSTEM_PROMPT
from tools import available_tools

load_dotenv()
client = OpenAI()


MAX_ITERATIONS = 25
MAX_CONSECUTIVE_PLANS = 2


def _preview(value, limit: int = 120) -> str:
    """Short, single-line preview of any value for logging."""
    text = json.dumps(value) if not isinstance(value, str) else value
    text = text.replace("\n", " ")
    if len(text) > limit:
        text = text[:limit] + f"... ({len(text)} chars total)"
    return text


def run_agent(query: str) -> None:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": query},
    ]

    consecutive_plans = 0

    for iteration in range(MAX_ITERATIONS):
        response = client.chat.completions.create(
            model="gpt-5-nano",
            messages=messages,
            response_format={"type": "json_object"},
        )
        assistant_reply = response.choices[0].message.content
        messages.append({"role": "assistant", "content": assistant_reply})
        parsed = json.loads(assistant_reply)
        step = parsed.get("step")

        if step == "plan":
            print(f"PLAN: {parsed.get('content')}")
            consecutive_plans += 1
            if consecutive_plans > MAX_CONSECUTIVE_PLANS:
                messages.append({
                    "role": "user",
                    "content": (
                        "You have planned enough. Stop emitting 'plan' steps. "
                        "Your next step MUST be 'action', 'clarify', or 'output'."
                    ),
                })
                consecutive_plans = 0
            continue

        consecutive_plans = 0

        if step == "clarify":
            print(f"CLARIFY: {parsed.get('content')}")
            user_reply = input("> ").strip()
            messages.append({"role": "user", "content": user_reply})
            continue

        if step == "action":
            tool_name = parsed.get("function")
            tool_input = parsed.get("input")
            preview = _preview(tool_input)
            print(f"Calling Tool => {tool_name} with Input => {preview}")

            if tool_name not in available_tools:
                output = f"Error: tool '{tool_name}' is not available."
            else:
                tool_fn = available_tools[tool_name]
                try:
                    if isinstance(tool_input, dict):
                        output = tool_fn(**tool_input)
                    else:
                        output = tool_fn(tool_input)
                except TypeError as exc:
                    output = f"Error calling {tool_name}: {exc}"

            messages.append({
                "role": "user",
                "content": json.dumps({"step": "observe", "content": output}),
            })
            continue

        if step == "output":
            print(f"✅ Final output: {parsed.get('content')}")
            return

    print("⚠️  Agent stopped: reached max iterations without producing output.")
