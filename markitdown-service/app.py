import os
import tempfile

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from markitdown import MarkItDown


app = FastAPI()


def require_token(authorization: str | None) -> None:
    token = os.getenv("MARKITDOWN_SERVICE_TOKEN")
    if not token:
        return
    if authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/parse")
async def parse(file: UploadFile = File(...), authorization: str | None = Header(default=None)) -> dict[str, str]:
    require_token(authorization)

    suffix = os.path.splitext(file.filename or "upload")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        result = MarkItDown().convert(tmp_path)
        markdown = (result.text_content or "").strip()
        if not markdown:
            raise HTTPException(status_code=422, detail="MarkItDown did not extract content")
        return {"markdown": markdown}
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
