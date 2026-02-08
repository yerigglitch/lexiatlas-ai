import os
import shutil
import tempfile
import subprocess
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse

app = FastAPI()

@app.post("/extract")
async def extract_text(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        return JSONResponse({"error": "Only PDF supported"}, status_code=400)

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input.pdf")
        output_pdf = os.path.join(tmpdir, "output.pdf")
        sidecar_txt = os.path.join(tmpdir, "output.txt")

        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            # Run OCR with sidecar text output
            subprocess.run(
                [
                    "ocrmypdf",
                    "--force-ocr",
                    "--language",
                    "fra",
                    "--sidecar",
                    sidecar_txt,
                    input_path,
                    output_pdf,
                ],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
        except subprocess.CalledProcessError as e:
            return JSONResponse({"error": e.stderr.decode("utf-8", errors="ignore")}, status_code=500)

        try:
            with open(sidecar_txt, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        except FileNotFoundError:
            text = ""

    return {"text": text}

@app.get("/health")
async def health():
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)
