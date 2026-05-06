cd phase-2-hello-world
uv init                  # one-time, creates pyproject.toml
uv add openai            # installs openai into a local .venv
uv run python example.py # runs your script using that venv