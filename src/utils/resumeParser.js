// src/utils/resumeParser.js — browser-side text extraction from PDF / DOCX.
import { analyzeResume } from "../lib/resumeHeuristics";

let pdfjsLib = null;
let mammoth = null;

const loadPDFJS = async () => {
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }
  return pdfjsLib;
};

const loadMammoth = async () => {
  if (!mammoth) mammoth = (await import("mammoth")).default;
  return mammoth;
};

/**
 * Rebuild real lines from PDF text items using their y-position. Joining every item with a
 * space (the old behaviour) collapsed a whole page into one line, which is why names were missed.
 */
export async function parsePDF(file) {
  const pdfjs = await loadPDFJS();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    const rows = [];
    for (const it of content.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = it.transform[5];
      const x = it.transform[4];
      let row = rows.find((r) => Math.abs(r.y - y) <= 3);
      if (!row) rows.push((row = { y, items: [] }));
      row.items.push({ x, str: it.str });
    }
    rows.sort((a, b) => b.y - a.y); // PDF y grows upward
    pages.push(rows.map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.str).join(" ").replace(/\s+/g, " ").trim()).join("\n"));
  }
  return pages.join("\n");
}

export async function parseDocx(file) {
  const m = await loadMammoth();
  const { value } = await m.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value;
}

export async function extractTextFromFile(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith(".pdf")) return parsePDF(file);
  if (n.endsWith(".docx")) return parseDocx(file);
  if (n.endsWith(".txt")) return file.text();
  throw new Error("Unsupported file type. Please upload a PDF, DOCX or TXT resume.");
}

/** Kept for backwards compatibility. */
export function extractContactInfo(text) {
  const p = analyzeResume(text);
  return { name: p.name || null, email: p.email, phone: p.phone, text };
}
