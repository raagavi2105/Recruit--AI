// src/utils/resumeParser.js
let pdfjsLib = null;
let mammoth = null;

const loadPDFJS = async () => {
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
    // best-effort worker path
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }
  return pdfjsLib;
};

const loadMammoth = async () => {
  if (!mammoth) mammoth = (await import("mammoth")).default;
  return mammoth;
};

const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const phoneRegex = /(\+?\d[\d ()-]{7,}\d)/;

export async function parsePDF(file) {
  const pdfjs = await loadPDFJS();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const t = await page.getTextContent();
    text += t.items.map((it) => it.str).join(" ") + "\n";
  }
  return text;
}

export async function parseDocx(file) {
  const mammothLib = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammothLib.extractRawText({ arrayBuffer });
  return value;
}

export function extractContactInfo(text) {
  const emailMatch = text.match(emailRegex);
  const phoneMatch = text.match(phoneRegex);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let name = null;
  for (let l of lines.slice(0, 8)) {
    if (emailRegex.test(l) || phoneRegex.test(l)) continue;
    if (/resume|curriculum|profile/i.test(l)) continue;
    if (/^[A-Za-z ,.'-]{2,40}$/.test(l)) {
      name = l;
      break;
    }
  }
  return {
    name: name || null,
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0] : null,
    text,
  };
}
