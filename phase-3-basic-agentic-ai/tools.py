import subprocess
from pathlib import Path

import requests


def get_weather(city: str) -> str:
    url = f"https://wttr.in/{city}?format=%C+%t"
    response = requests.get(url)
    if response.status_code == 200:
        return f"The weather in {city} is {response.text}."
    return "Something went wrong while fetching weather."


def run_command(cmd: str) -> str:
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        output = (result.stdout + result.stderr).strip()
        return output or f"(command exited with code {result.returncode})"
    except subprocess.TimeoutExpired:
        return "Command timed out after 30 seconds."
    except Exception as exc:
        return f"Error running command: {exc}"


def write_file(path: str, content: str) -> str:
    try:
        p = Path(path)
        if p.parent and not p.parent.exists():
            p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return f"Wrote {len(content)} bytes to {p.resolve()}."
    except Exception as exc:
        return f"Error writing {path}: {exc}"


def read_file(path: str) -> str:
    try:
        text = Path(path).read_text(encoding="utf-8")
        if len(text) > 4000:
            return text[:4000] + f"\n... (truncated, total {len(text)} chars)"
        return text
    except FileNotFoundError:
        return f"Error: file '{path}' does not exist."
    except Exception as exc:
        return f"Error reading {path}: {exc}"


available_tools = {
    "get_weather": get_weather,
    "run_command": run_command,
    "write_file": write_file,
    "read_file": read_file,
}
