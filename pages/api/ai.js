// pages/api/ai.js — single entry point for all AI actions (see src/lib/interviewEngine.js)
import { llmConfigured, llmModel } from "../../src/lib/llm";
import { parseResume, generateQuestions, rateAnswer, getHint, finalReport } from "../../src/lib/interviewEngine";

export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

export default async function handler(req, res) {
  const body = req.body || {};
  try {
    switch (body.action) {
      case "status":
        return res.status(200).json({ ai: llmConfigured(), model: llmConfigured() ? llmModel() : null });
      case "parse_resume":
        return res.status(200).json(await parseResume({ text: String(body.text || ""), filename: body.filename }));
      case "generate_questions":
        return res.status(200).json(
          await generateQuestions({ roleId: body.role, count: body.count, profile: body.profile || {}, resumeText: String(body.resumeText || "").slice(0, 3000) })
        );
      case "rate_answer":
        return res.status(200).json(await rateAnswer(body));
      case "hint":
        return res.status(200).json(await getHint(body));
      case "final_summary_and_score":
        return res.status(200).json(await finalReport(body));
      default:
        return res.status(400).json({ error: "Unknown action" });
    }
  } catch (e) {
    console.error("AI API unexpected error:", e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
