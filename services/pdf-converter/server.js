const express = require("express");
const multer = require("multer");
const { execFile } = require("child_process");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const upload = multer({ dest: "/tmp" });

function runLibreOffice(docxPath, outDir) {
  return new Promise((resolve, reject) => {
    execFile(
      "soffice",
      ["--headless", "--convert-to", "pdf", "--outdir", outDir, docxPath],
      { timeout: 60000 },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      }
    );
  });
}

app.post("/convert", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Missing file" });
  }

  const tempPath = req.file.path;
  const docxPath = `${tempPath}.docx`;
  const outDir = path.dirname(docxPath);
  const baseName = path.basename(docxPath, path.extname(docxPath));
  const pdfPath = path.join(outDir, `${baseName}.pdf`);

  try {
    await fs.rename(tempPath, docxPath);
    await runLibreOffice(docxPath, outDir);
    const pdfBuffer = await fs.readFile(pdfPath);

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error?.message || "Conversion failed" });
  } finally {
    await Promise.allSettled([
      fs.rm(docxPath, { force: true }),
      fs.rm(pdfPath, { force: true })
    ]);
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`PDF converter listening on ${port}`);
});
