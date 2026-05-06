from dotenv import load_dotenv
from openai import OpenAI
import json
import requests

load_dotenv()
client = OpenAI()  # automatically reads OPENAI_API_KEY from .env


# ---------- TOOL FUNCTION ----------
def get_weather(city: str):
    """Fetch current weather for a city using wttr.in (free, no API key)."""
    url = f"https://wttr.in/{city}?format=%C+%t"
    response = requests.get(url)
    if response.status_code == 200:
        return f"The weather in {city} is {response.text}."
    return "Something went wrong while fetching weather."


# ---------- TOOL REGISTRY ----------
available_tools = {
    "get_weather": get_weather
}


# ---------- SYSTEM PROMPT ----------
SYSTEM_PROMPT = """
You are a helpful AI assistant who is specialized in resolving user queries.
You work on start, plan, action, observe mode.

For the given user query and available tools, plan the step-by-step execution.
Based on the planning, select the relevant tool from the available tools.
Based on the tool selection, perform an action to call the tool.
Observe after getting response from the tool call, if the response 
is satisfactory, resolve the user query, otherwise, plan again.

Rules:
- Follow the strict JSON output format.
- Always perform one step at a time and wait for the next input.
- Carefully analyze the user query.

Output JSON Format:
{
    "step": "string",          // one of: plan, action, observe, output
    "content": "string",       // your reasoning or final answer
    "function": "string",      // name of function (only for 'action' step)
    "input": "string"          // input to function (only for 'action' step)
}

Available Tools:
- get_weather: Takes a city name as input and returns the current weather.

Example:
User Query: What is the weather in Delhi?
Output: { "step": "plan", "content": "The user wants the weather in Delhi." }
Output: { "step": "plan", "content": "I should call get_weather with 'Delhi'." }
Output: { "step": "action", "function": "get_weather", "input": "Delhi" }
Output: { "step": "observe", "content": "12°C" }
Output: { "step": "output", "content": "The weather in Delhi is 12°C." }
"""


# ---------- MAIN CONVERSATION ----------
messages = [
    {"role": "system", "content": SYSTEM_PROMPT}
]

query = input("Enter city name: ")
messages.append({"role": "user", "content": query})


while True:
    response = client.chat.completions.create(
        model="gpt-5-nano",
        response_format={"type": "json_object"},
        messages=messages
    )

    # AI's reply (a JSON string)
    assistant_reply = response.choices[0].message.content
    
    # Save it to history so AI remembers its own thinking
    messages.append({"role": "assistant", "content": assistant_reply})
    
    # Convert JSON string → Python dict
    parsed_response = json.loads(assistant_reply)

    step = parsed_response.get("step")

    # ---------- STEP: PLAN ----------
    if step == "plan":
        print(f"PLAN: {parsed_response.get('content')}")
        continue   # go back to top of loop, let AI think more

    # ---------- STEP: ACTION ----------
    if step == "action":
        tool_name = parsed_response.get("function")
        tool_input = parsed_response.get("input")
        print(f"ACTION: Calling {tool_name} with input '{tool_input}'")

        if tool_name in available_tools:
            tool_output = available_tools[tool_name](tool_input)
        else:
            tool_output = f"Error: tool '{tool_name}' is not available."

        print(f"tool_output: {tool_output}")

        messages.append({
            "role": "user",
            "content": json.dumps({"step": "observe", "content": tool_output})
        })
        continue

    # ---------- STEP: OUTPUT (BASE CASE) ----------
    if step == "output":
        print(f"OUTPUT: {parsed_response.get('content')}")
        break
"""
Pseudo Code:
if step == "plan":   print(...); continue
if step == "action": run tool; continue
if step == "output": print(...); break
"""