# Python image with uv pre-installed (used for dependency management)
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Copy only the lockfile/manifest first so dependency layer is cached
COPY pyproject.toml ./
RUN uv sync --no-install-project

# Source is volume-mounted in docker-compose for hot reload, but we still
# copy it here so the image is runnable on its own.
COPY . .
RUN uv sync

EXPOSE 8000

# --reload picks up file changes from the bind mount
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
