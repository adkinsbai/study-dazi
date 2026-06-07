# MarkItDown Service

CPU-only document parsing service for Vercel-hosted `study-dazi`.

## Run locally

```bash
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

Optional shared token:

```bash
export MARKITDOWN_SERVICE_TOKEN=change-me
```

Then configure the Vercel project:

```env
MARKITDOWN_API_URL=https://your-service.example.com/parse
MARKITDOWN_API_TOKEN=change-me
```
