// src/lib/resumeHeuristics.js — pure functions (no DOM / Node APIs) so they run in the
// browser for instant feedback and on the server as the fallback when the LLM is unavailable.
import { rankRoles } from "./roles";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(\+?\d[\d\s().-]{8,}\d)/;
const LINK_RE = /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in|github\.com|gitlab\.com|[a-z0-9-]+\.(?:dev|io|me))\/[^\s,;|)]+/gi;

const HEADER_WORDS = /\b(resume|curriculum|vitae|cv|profile|summary|objective|contact|education|experience|skills|projects?|portfolio|certifications?|achievements?|references|declaration|about me|personal|details|internships?|languages)\b/i;
const NON_NAME_WORDS = /\b(engineer|developer|student|intern|university|college|institute|school|manager|analyst|scientist|designer|consultant|b\.?tech|m\.?tech|bachelor|master|present|address|street|road|india|usa|llc|inc|ltd|technologies|solutions|software|full[- ]?stack|backend|frontend)\b/i;

const SKILLS = [
  "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Go", "Rust", "Kotlin", "Swift", "Scala", "R", "SQL", "NoSQL", "Bash",
  "React", "Next.js", "Angular", "Vue", "Node.js", "Express", "Django", "Flask", "FastAPI", "Spring Boot", "Spring", ".NET", "GraphQL", "REST", "gRPC", "Tailwind",
  "MongoDB", "PostgreSQL", "MySQL", "Redis", "Kafka", "RabbitMQ", "Elasticsearch", "Snowflake", "BigQuery", "Spark", "Hadoop", "Airflow", "dbt",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitHub Actions", "CI/CD", "Linux", "Helm", "Prometheus", "Grafana", "Lambda", "EC2", "S3",
  "TensorFlow", "PyTorch", "Keras", "scikit-learn", "XGBoost", "Pandas", "NumPy", "Matplotlib", "Seaborn", "Tableau", "Power BI", "Jupyter",
  "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "MLOps", "MLflow", "OpenCV", "Transformers", "Hugging Face",
  "LLM", "OpenAI", "LangChain", "LlamaIndex", "RAG", "Embeddings", "Vector Database", "Pinecone", "ChromaDB", "FAISS", "Prompt Engineering", "Generative AI",
  "Cybersecurity", "OWASP", "Penetration Testing", "SIEM", "Burp Suite", "Nmap", "Wireshark", "Metasploit", "Kali Linux", "Cryptography", "Ethical Hacking", "Splunk",
  "Git", "Data Structures", "Algorithms", "Microservices", "System Design", "OOP", "Agile", "Statistics", "A/B Testing",
];

const SECTION_RE = /^(?:work\s+)?(experience|professional experience|employment|internships?|projects?|academic projects?|personal projects?|education|academics?|skills|technical skills|certifications?|achievements?|summary|objective|profile|languages|interests|publications|awards)\s*:?$/i;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const titleCase = (s) =>
  s.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

/** Clean a candidate name string; returns "" when it does not look like a person's name. */
export function cleanName(raw) {
  if (!raw || typeof raw !== "string") return "";
  let s = raw.replace(/[|•·_,]+/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/\b(mr|mrs|ms|dr)\.?\s+/i, "");
  const tokens = s.split(" ").filter(Boolean);
  if (tokens.length < 1 || tokens.length > 4) return "";
  if (!tokens.every((t) => /^[A-Za-z][A-Za-z.'’-]*$/.test(t))) return "";
  if (HEADER_WORDS.test(s) || NON_NAME_WORDS.test(s)) return "";
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return "";
  const allCaps = s === s.toUpperCase();
  return allCaps || s === s.toLowerCase() ? titleCase(s) : s;
}

export function nameFromEmail(email) {
  if (!email) return "";
  const local = email.split("@")[0].replace(/\d+/g, " ").replace(/[._-]+/g, " ").trim();
  const parts = local.split(/\s+/).filter((p) => p.length > 1 || local.split(/\s+/).length > 1);
  return parts.length ? titleCase(parts.join(" ")) : "";
}

export function nameFromFilename(filename) {
  if (!filename) return "";
  const base = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").replace(/\b(resume|cv|curriculum|vitae|updated|final|new|latest|copy|\d+)\b/gi, " ").replace(/\s+/g, " ").trim();
  return cleanName(base);
}

export function extractName(text, { email, filename } = {}) {
  const lines = (text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 15);
  for (const line of lines) {
    if (EMAIL_RE.test(line) || /https?:|www\.|linkedin|github/i.test(line)) {
      // The name may share a line with contact info: "Jane Doe | jane@x.com"
      const head = line.split(/[|•·]|\s{2,}|\s[-–]\s|,\s*\+?\d|\s\+?\d/)[0];
      const n = cleanName(head);
      if (n && n.split(" ").length >= 2) return n;
      continue;
    }
    if (/\d{3,}/.test(line) || line.length > 60) continue;
    const n = cleanName(line);
    if (n && (n.split(" ").length >= 2 || (n.length >= 3 && line === line.toUpperCase()))) return n;
  }
  // Last resort: name glued to the start of an un-split blob of text
  const head = (text || "").trim().slice(0, 120);
  const m = head.match(/^([A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){1,3})(?=\s|$)/) || head.match(/^([A-Z]{2,}(?:\s+[A-Z.]{1,}){1,3})(?=\s|$)/);
  if (m) {
    const n = cleanName(m[1]);
    if (n) return n;
  }
  return nameFromFilename(filename) || nameFromEmail(email) || "";
}

export function extractSkills(text) {
  const found = [];
  for (const skill of SKILLS) {
    const re = new RegExp(`(?<![A-Za-z0-9+#.])${esc(skill)}(?![A-Za-z0-9+#])`, skill.length <= 2 ? "" : "i");
    if (re.test(text)) found.push(skill);
  }
  // collapse "Spring" when "Spring Boot" present
  return found.filter((s) => !(s === "Spring" && found.includes("Spring Boot")));
}

function splitSections(text) {
  const sections = {};
  let current = "header";
  sections[current] = [];
  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const m = line.replace(/[:\-–_]+$/g, "").match(SECTION_RE);
    if (m && line.length < 40) {
      const key = m[1].toLowerCase();
      current = /project/.test(key) ? "projects" : /experience|employment|internship/.test(key) ? "experience" : /education|academic/.test(key) ? "education" : /skill/.test(key) ? "skills" : key;
      sections[current] = sections[current] || [];
    } else sections[current].push(line);
  }
  return sections;
}

const BULLET = /^[•▪▫◦●○■□‣⁃*>\-–·]\s*/;
const DATE_RE = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d{2}\s*(?:[-–—to]+\s*(?:(?:19|20)\d{2}|present|current|ongoing))?/i;

function parseExperience(lines = []) {
  const out = [];
  for (const line of lines) {
    const isBullet = BULLET.test(line);
    const clean = line.replace(BULLET, "");
    if (!isBullet && DATE_RE.test(line) && line.length < 140) {
      const duration = (line.match(DATE_RE) || [""])[0].trim();
      const title = line.replace(DATE_RE, "").replace(/[|,–-]\s*$/g, "").trim();
      out.push({ title: title || line, company: "", duration, highlights: [] });
    } else if (out.length && out[out.length - 1].highlights.length < 3) out[out.length - 1].highlights.push(clean);
    else if (!out.length && !isBullet && line.length < 100) out.push({ title: clean, company: "", duration: "", highlights: [] });
  }
  return out.slice(0, 5);
}

function parseProjects(lines = []) {
  const out = [];
  for (const line of lines) {
    const isBullet = BULLET.test(line);
    const clean = line.replace(BULLET, "");
    if (!isBullet && line.length < 90 && !/[.]$/.test(line)) out.push({ name: clean.replace(/\s*[|–-].*$/, "").trim() || clean, tech: [], summary: "" });
    else if (out.length && !out[out.length - 1].summary) out[out.length - 1].summary = clean.slice(0, 220);
  }
  return out.slice(0, 5).map((p) => ({ ...p, tech: extractSkills(`${p.name} ${p.summary}`).slice(0, 6) }));
}

function parseEducation(lines = []) {
  return lines
    .filter((l) => /(b\.?\s?tech|m\.?\s?tech|b\.?e\b|b\.?sc|m\.?sc|bachelor|master|ph\.?d|diploma|mba|university|college|institute)/i.test(l) && l.length < 160)
    .slice(0, 3)
    .map((l) => ({ degree: l.replace(BULLET, ""), school: "", year: (l.match(/(19|20)\d{2}/) || [""])[0] }));
}

function estimateYears(text) {
  const m = text.match(/(\d{1,2}(?:\.\d)?)\+?\s*(?:years?|yrs?)\b[^.\n]{0,30}(?:experience|exp)/i);
  return m ? Number(m[1]) : null;
}

/** Heuristic structured profile — the offline fallback and the "instant preview" in the browser. */
export function analyzeResume(text, { filename } = {}) {
  const clean = (text || "").replace(/\u0000/g, "").trim();
  const email = (clean.match(EMAIL_RE) || [null])[0];
  const phoneRaw = (clean.replace(EMAIL_RE, " ").match(PHONE_RE) || [null])[0];
  const phone = phoneRaw && phoneRaw.replace(/\D/g, "").length >= 9 ? phoneRaw.trim() : null;
  const links = [...new Set((clean.match(LINK_RE) || []).map((l) => l.replace(/[.,;]$/, "")))].slice(0, 4);
  const sections = splitSections(clean);
  const skills = extractSkills(clean);
  const experience = parseExperience(sections.experience);
  const projects = parseProjects(sections.projects);
  const [best, second] = rankRoles(clean, skills);

  return {
    name: extractName(clean, { email, filename }),
    email,
    phone,
    links,
    headline: "",
    summary: (sections.summary || sections.profile || sections.objective || []).slice(0, 3).join(" ").slice(0, 300),
    yearsExperience: estimateYears(clean),
    skills,
    experience,
    projects,
    education: parseEducation(sections.education),
    suggestedRole: best.score > 0 ? best.id : null,
    alternateRole: second && second.score > 0 ? second.id : null,
  };
}

/** Coerce an LLM-produced profile into the shape the UI expects, falling back to heuristics per field. */
export function normalizeProfile(p = {}, fallback = {}) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const orFallback = (list, fb) => (list.length ? list : fb || []);

  const links = arr(p.links).map(String).slice(0, 5);
  const experience = arr(p.experience)
    .map((e) => ({ title: str(e?.title), company: str(e?.company), duration: str(e?.duration), highlights: arr(e?.highlights).map(String).slice(0, 4) }))
    .filter((e) => e.title || e.company)
    .slice(0, 6);
  const projects = arr(p.projects)
    .map((x) => ({ name: str(x?.name), tech: arr(x?.tech).map(String).slice(0, 8), summary: str(x?.summary).slice(0, 300) }))
    .filter((x) => x.name)
    .slice(0, 6);
  const education = arr(p.education)
    .map((e) => ({ degree: str(e?.degree), school: str(e?.school), year: str(e?.year) }))
    .filter((e) => e.degree || e.school)
    .slice(0, 3);
  const years = p.yearsExperience === null || p.yearsExperience === undefined || p.yearsExperience === "" ? NaN : Number(p.yearsExperience);

  return {
    name: cleanName(str(p.name)) || fallback.name || "",
    email: str(p.email) || fallback.email || null,
    phone: str(p.phone) || fallback.phone || null,
    location: str(p.location),
    links: orFallback(links, fallback.links),
    headline: str(p.headline),
    summary: str(p.summary).slice(0, 400) || fallback.summary || "",
    yearsExperience: Number.isFinite(years) ? years : fallback.yearsExperience ?? null,
    skills: [...new Set([...arr(p.skills).map(String), ...(fallback.skills || [])])].filter(Boolean).slice(0, 40),
    experience: orFallback(experience, fallback.experience),
    projects: orFallback(projects, fallback.projects),
    education: orFallback(education, fallback.education),
    suggestedRole: fallback.suggestedRole || null,
    alternateRole: fallback.alternateRole || null,
  };
}
