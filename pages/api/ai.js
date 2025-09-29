// pages/api/ai.js
import axios from "axios";

const GROQ_BASE = "https://api.groq.com/openai/v1";
const GROQ_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

async function callGroqChat(prompt, max_tokens = 400) {
  if (!GROQ_KEY) throw new Error("No GROQ_API_KEY present");
  const payload = {
    model: MODEL,
    messages: [{ role: "user", content: `${prompt}\n\nONLY return valid JSON. No commentary.` }],
    max_tokens,
    temperature: 0.18,
  };
  const resp = await axios.post(`${GROQ_BASE}/chat/completions`, payload, {
    headers: { Authorization: `Bearer ${GROQ_KEY}` },
    timeout: 25000,
  });
  const choice = resp.data?.choices?.[0];
  return choice?.message?.content || choice?.text || JSON.stringify(resp.data);
}

function safeParseJSON(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const cleaned = rawText.replace(/```[a-zA-Z]*\n?/g, "").replace(/```$/g, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const match = cleaned.match(/(\[.*\]|\{.*\})/s);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

function fallbackScoreEvaluator(expectedPoints = [], answerText = "", difficulty = "medium") {
  const normalizedAnswer = (answerText || "").toLowerCase();
  const expected = Array.isArray(expectedPoints) ? expectedPoints : [];
  const matched = [];
  const missed = [];

  expected.forEach((p) => {
    const token = (p || "").toLowerCase();
    const words = token.split(/\W+/).filter(Boolean);
    const present = words.every((w) => normalizedAnswer.includes(w) || normalizedAnswer.includes(w.replace(/s$/, "")));
    if (present) matched.push(p); else missed.push(p);
  });

  const fraction = expected.length ? matched.length / expected.length : 0;
  let baseScore = Math.round(fraction * 100);
  const len = (answerText || "").trim().length;
  if (len < 40) baseScore = Math.max(0, baseScore - 12);
  else if (len < 100) baseScore = Math.max(0, baseScore - 6);

  if (difficulty === "hard") baseScore = Math.round(baseScore * 0.92);
  if (difficulty === "easy") baseScore = Math.round(Math.min(100, baseScore * 1.05));
  baseScore = Math.max(0, Math.min(100, baseScore));

  let feedback = "";
  if (baseScore >= 86) feedback = "Excellent — addressed nearly all expected points clearly.";
  else if (baseScore >= 71) feedback = "Good — most points covered, some minor gaps.";
  else if (baseScore >= 41) feedback = "Fair — partial coverage; some expected points missing or shallow.";
  else feedback = "Poor — many expected points missing or incorrect.";

  return { score: baseScore, feedback, matched_points: matched, missed_points: missed };
}

export default async function handler(req, res) {
  const { action } = req.body || {};

  try {
    if (action === "generate_questions") {
      const role = req.body.role || "Full Stack (React/Node)";
      const resumeText = (req.body.resumeText || "").slice(0, 1500);

      // IMPORTANT: this prompt explicitly BANS architecture/system-design style questions.
      // It forces only chat-answerable questions (concepts, debugging, optimization, small design tradeoffs).
      const prompt = `
Return EXACTLY a JSON array of 6 interview questions for the role: ${role}.
Order: 2 easy, 2 medium, 2 hard.

CRITICAL RULES (must be obeyed exactly):
- NEVER produce "system design", "architecture", "large-scale design", or "draw a diagram" style questions.
- Questions must be answerable in a chat message (short essay or 3-5 concise bullets).
- If a topic touches on architecture, convert it into a focused, chat-sized question (e.g., "List 4 concise tradeoffs for X" or "Give 4 bullet points to optimize Y").
- Keep text <= 25 words per question.
- Ensure each question has clear expected_points (3-6 concise items) and an estimated_time.

If resumeText is provided, include AT MOST ONE personalized question referencing a skill or project (no PII).

Return only the JSON array. Each object must contain:
{
  "id": <0..5>,
  "difficulty": "easy"|"medium"|"hard",
  "text": "<<=25 words>",
  "expected_points": ["point1","point2","..."],
  "estimated_time": <seconds> // easy=20, medium=60, hard=120
}

Resume snippet: ${resumeText || "(none)"}

RETURN ONLY THE JSON ARRAY. DO NOT return architecture/system design prompts.
`;

      try {
        const raw = await callGroqChat(prompt, 1000);
        console.log("generate_questions raw preview:", (raw || "").slice(0, 600));
        let parsed = safeParseJSON(raw);
        if (parsed?.questions && Array.isArray(parsed.questions)) parsed = parsed.questions;

        if (!Array.isArray(parsed) || parsed.length !== 6) {
          const arrMatch = (raw || "").match(/\[[\s\S]*\]/);
          if (arrMatch) parsed = safeParseJSON(arrMatch[0]);
        }

        if (!Array.isArray(parsed)) throw new Error("Invalid question array");

        const normalized = parsed.slice(0, 6).map((q, i) => ({
          id: typeof q.id === "number" ? q.id : i,
          difficulty: q.difficulty || (i < 2 ? "easy" : i < 4 ? "medium" : "hard"),
          text: (q.text || "").toString().trim(),
          expected_points: Array.isArray(q.expected_points) ? q.expected_points.map(String) : [],
          estimated_time: q.estimated_time || (q.difficulty === "hard" ? 120 : q.difficulty === "medium" ? 60 : 20),
        }));

        while (normalized.length < 6) {
          const DIFFICULTY = ["easy", "easy", "medium", "medium", "hard", "hard"];
          const i = normalized.length;
          normalized.push({
            id: i,
            difficulty: DIFFICULTY[i],
            text: `${DIFFICULTY[i]} fallback question ${i + 1}`,
            expected_points: [],
            estimated_time: DIFFICULTY[i] === "easy" ? 20 : DIFFICULTY[i] === "medium" ? 60 : 120,
          });
        }

        // final safety check: ensure none of the questions mention "design" or "architecture" as the main ask
        const safeQuestions = normalized.map((q) => {
          const forbidden = /(design|architecture|system design|diagram|draw|sketch)/i;
          if (forbidden.test(q.text)) {
            // convert to chat-sized alternative
            return {
              ...q,
              text: `Explain 3 concise tradeoffs for: ${q.text.replace(forbidden, "").trim()}`.slice(0, 140),
              expected_points: q.expected_points.length ? q.expected_points : ["tradeoff1","tradeoff2","tradeoff3"],
              estimated_time: 60,
            };
          }
          return q;
        });

        return res.status(200).json({ questions: safeQuestions });
      } catch (err) {
        console.error("generate_questions error:", err.message || err);
        const DIFFICULTY = ["easy", "easy", "medium", "medium", "hard", "hard"];
        const fallback = DIFFICULTY.map((d, i) => ({
          id: i,
          difficulty: d,
          text: `${d} sample question ${i + 1}`,
          expected_points: d === "easy" ? ["core concept"] : d === "medium" ? ["approach","tradeoffs"] : ["performance","tradeoffs"],
          estimated_time: d === "easy" ? 20 : d === "medium" ? 60 : 120,
        }));
        return res.status(200).json({ questions: fallback });
      }
    }

    if (action === "rate_answer") {
      const { question, answer, difficulty, expected_points } = req.body || {};
      const prompt = `
You are a strict full-stack interviewer. Use expected_points as the rubric.

Rules:
- For each expected point, mark matched/missed.
- Score 0-100 using bands:
  0-40 poor, 41-70 fair, 71-85 good, 86-100 excellent.
- Do NOT give 100 unless full correctness & depth.
Return ONLY JSON:
{"score":<0-100>,"feedback":"<one-sentence>","matched_points":["..."],"missed_points":["..."]}

Question: ${question}
Expected points: ${JSON.stringify(expected_points || [])}
Candidate answer: ${answer}
Difficulty: ${difficulty || "medium"}
`;
      try {
        const raw = await callGroqChat(prompt, 400);
        console.log("rate_answer raw preview:", (raw || "").slice(0, 400));
        const parsed = safeParseJSON(raw);
        if (parsed && parsed.score !== undefined) {
          return res.status(200).json({
            score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
            feedback: (parsed.feedback || "").toString().slice(0, 240),
            matched_points: Array.isArray(parsed.matched_points) ? parsed.matched_points.map(String) : [],
            missed_points: Array.isArray(parsed.missed_points) ? parsed.missed_points.map(String) : [],
          });
        }
        const fallback = fallbackScoreEvaluator(expected_points || [], answer || "", difficulty || "medium");
        return res.status(200).json(fallback);
      } catch (err) {
        console.error("rate_answer error:", err.message || err);
        const fallback = fallbackScoreEvaluator(expected_points || [], answer || "", difficulty || "medium");
        return res.status(200).json(fallback);
      }
    }

    if (action === "final_summary_and_score") {
      const { session } = req.body || {};
      const prompt = `
Return ONLY JSON:
{"score":<0-100>,"summary":"<=40 words"}
Session: ${JSON.stringify(session)}
`;
      try {
        const raw = await callGroqChat(prompt, 500);
        console.log("final_summary raw preview:", (raw || "").slice(0, 400));
        const parsed = safeParseJSON(raw);
        if (parsed && parsed.score !== undefined) {
          return res.status(200).json({ score: Math.max(0, Math.min(100, Number(parsed.score) || 0)), summary: (parsed.summary || "").toString().slice(0, 400) });
        }
        const sum = (session.answers || []).reduce((a, b) => a + (b.rating?.score || 0), 0);
        const avg = session.answers?.length ? Math.round(sum / session.answers.length) : 0;
        return res.status(200).json({ score: avg, summary: "Mock summary (fallback)." });
      } catch (err) {
        console.error("final_summary error:", err.message || err);
        const sum = (session.answers || []).reduce((a, b) => a + (b.rating?.score || 0), 0);
        const avg = session.answers?.length ? Math.round(sum / session.answers.length) : 0;
        return res.status(200).json({ score: avg, summary: "Mock summary (error)." });
      }
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("AI API unexpected error:", e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
