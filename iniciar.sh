#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"

# Preparar las dos capas y servir la aplicación completa desde FastAPI.
command -v uv >/dev/null || { echo "Instala uv para preparar Python: https://docs.astral.sh/uv/"; exit 1; }
command -v npm >/dev/null || { echo "Instala Node.js 22.12 o superior con npm."; exit 1; }
uv sync --frozen
npm --prefix frontend ci
npm --prefix frontend run build
echo "Abre http://127.0.0.1:8019 · Ctrl+C para detener."
exec uv run uvicorn backend.main:app --host 127.0.0.1 --port 8019
