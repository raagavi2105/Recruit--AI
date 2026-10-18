// src/lib/interviewEngine.js — server-side logic for every AI action, each with an offline fallback
// so the app is fully usable (and honest about it) when no LLM key is configured.
import { llmJSON, llmConfigured } from "./llm";
import { analyzeResume, normalizeProfile } from "./resumeHeuristics";
import { getRole, TIME_BY_DIFFICULTY } from "./roles";

const DIFFS = ["easy", "medium", "hard"];
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
const WEIGHT = { easy: 1, medium: 1.5, hard: 2 };

/* ------------------------------------------------------------------ resume */

export async function parseResume({ text, filename }) {
  const heuristic = analyzeResume(text, { filename });
  if (!llmConfigured()) return { profile: heuristic, source: "offline" };

  try {
    const ai = await llmJSON({
      system:
        "You are an expert technical recruiter extracting structured data from resume text. The text comes from PDF/DOCX extraction, so line breaks and ordering may be messy. " +
        "Be accurate: never invent facts. The candidate's name is usually at the very top of the resume; return it properly capitalised (e.g. 'Raagavi Gopinathan'), never an email, job title or section heading.",
      user: `Extract this schema from the resume:
{
  "name": string,
  "email": string|null,
  "phone": string|null,
  "location": string|null,
  "links": string[],
  "headline": string (one-line professional headline, max 12 words),
  "summary": string (2 sentences max, neutral tone),
  "yearsExperience": number|null (professional experience only, 0 for fresher/student),
  "skills": string[] (technical skills actually mentioned, max 30),
  "experience": [{"title": string, "company": string, "duration": string, "highlights": string[] (max 3, concise)}],
  "projects": [{"name": string, "tech": string[], "summary": string (1 sentence)}],
  "education": [{"degree": string, "school": string, "year": string}]
}

RESUME:
"""
${(text || "").slice(0, 9000)}
"""`,
      maxTokens: 1800,
      temperature: 0.1,
    });
    return { profile: normalizeProfile(ai, heuristic), source: "ai" };
  } catch (e) {
    console.error("parseResume LLM failed, using heuristics:", e.message);
    return { profile: heuristic, source: "offline", warning: e.message };
  }
}

/* --------------------------------------------------------------- questions */

function difficultyPlan(count) {
  const easy = Math.max(1, Math.round(count * 0.3));
  const hard = Math.max(1, Math.round(count * 0.3));
  const medium = Math.max(1, count - easy - hard);
  return { easy, medium, hard };
}

function personalisedOffline(profile = {}, role) {
  const out = [];
  const proj = (profile.projects || []).find((p) => p.name);
  if (proj) {
    out.push({
      difficulty: "medium",
      topic: "Your project",
      personalized: true,
      text: `Your resume lists the project "${proj.name}". What was the hardest technical problem you hit, and how did you solve it?`,
      expected_points: ["clear description of the problem", "options considered", "chosen solution and why", "result or measurable impact", "what they would do differently"],
    });
  }
  const exp = (profile.experience || []).find((e) => e.title || e.company);
  if (exp) {
    out.push({
      difficulty: "medium",
      topic: "Your experience",
      personalized: true,
      text: `Tell me about a contribution you are proud of as ${exp.title || "a team member"}${exp.company ? ` at ${exp.company}` : ""}. What was your specific role and the outcome?`,
      expected_points: ["specific own contribution", "technical approach", "collaboration", "measurable outcome"],
    });
  }
  const roleSkills = (profile.skills || []).filter((s) => getRole(role).keywords.some((k) => s.toLowerCase().includes(k) || k.includes(s.toLowerCase())));
  const skill = roleSkills[0] || (profile.skills || [])[0];
  if (skill) {
    out.push({
      difficulty: "easy",
      topic: skill,
      personalized: true,
      text: `You list ${skill} on your resume. Where have you used it, and what is one limitation or pitfall you've learned about it?`,
      expected_points: ["concrete usage example", "understands core concepts", "knows a real limitation or pitfall", "how they worked around it"],
    });
  }
  return out;
}

export function offlineQuestions({ roleId, count, profile }) {
  const role = getRole(roleId);
  const plan = difficultyPlan(count);
  const personal = personalisedOffline(profile, roleId).slice(0, Math.max(1, Math.min(3, Math.floor(count / 3))));
  const picked = [...personal];
  for (const d of DIFFS) {
    const have = picked.filter((x) => x.difficulty === d).length;
    const pool = role.bank.filter((b) => b.difficulty === d);
    const needed = Math.max(0, plan[d] - have);
    picked.push(...shuffle(pool).slice(0, needed));
  }
  // top-up if the bank ran short
  const leftovers = shuffle(role.bank.filter((b) => !picked.includes(b)));
  while (picked.length < count && leftovers.length) picked.push(leftovers.pop());
  return finalizeQuestions(picked.slice(0, count));
}

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

function finalizeQuestions(list) {
  return list
    .map((x) => ({
      difficulty: DIFFS.includes(x.difficulty) ? x.difficulty : "medium",
      topic: String(x.topic || "General").slice(0, 40),
      text: String(x.text || "").trim(),
      expected_points: (Array.isArray(x.expected_points) ? x.expected_points : []).map(String).filter(Boolean).slice(0, 6),
      personalized: Boolean(x.personalized),
    }))
    .filter((x) => x.text.length > 10)
    .sort((a, b) => DIFFS.indexOf(a.difficulty) - DIFFS.indexOf(b.difficulty))
    .map((x, i) => ({ id: i, ...x, estimated_time: TIME_BY_DIFFICULTY[x.difficulty] }));
}

export async function generateQuestions({ roleId, count = 6, profile = {}, resumeText = "" }) {
  const role = getRole(roleId);
  count = Math.max(3, Math.min(12, Number(count) || 6));
  if (!llmConfigured()) return { questions: offlineQuestions({ roleId, count, profile }), source: "offline" };

  const plan = difficultyPlan(count);
  const compact = {
    yearsExperience: profile.yearsExperience,
    headline: profile.headline,
    skills: (profile.skills || []).slice(0, 25),
    experience: (profile.experience || []).slice(0, 4),
    projects: (profile.projects || []).slice(0, 4),
    education: (profile.education || []).slice(0, 2),
  };
  const hasResume = compact.skills.length || compact.experience.length || compact.projects.length || resumeText;

  try {
    const ai = await llmJSON({
      system:
        `You are a senior ${role.label} interviewer running a live chat interview. You write sharp, specific, non-generic questions that test real understanding, not trivia. ` +
        "Questions must be answerable in a chat message (a short paragraph or 3-6 bullets): no whiteboard/diagram/coding-from-scratch tasks, but short snippets or scenarios are fine.",
      user: `Create exactly ${count} interview questions for the role "${role.label}".
Focus areas for this role: ${role.focus.join(", ")}.
Difficulty mix: ${plan.easy} easy, ${plan.medium} medium, ${plan.hard} hard, ordered easy -> hard.

${hasResume ? `CANDIDATE PROFILE (from resume):
${JSON.stringify(compact)}

PERSONALISATION RULES:
- At least ${Math.max(2, Math.round(count * 0.5))} questions MUST be grounded in this candidate's actual projects, experience or listed skills. Name the specific project/company/technology in the question (e.g. "In your <project> you used <tech> — how did you handle X?").
- Scale difficulty to their seniority (${compact.yearsExperience ?? "unknown"} years). For freshers, probe fundamentals and project depth.
- Skills on the resume that are irrelevant to the ${role.label} role should be ignored.
- Mark personalised questions with "personalized": true.` : "No resume was provided, so ask strong role-relevant questions."}

Each question: max 40 words, single focused ask. "expected_points" = 3-6 concise rubric items an ideal answer would hit. "topic" = 1-3 word label.

Return: {"questions":[{"difficulty":"easy|medium|hard","topic":string,"text":string,"expected_points":string[],"personalized":boolean}]}`,
      maxTokens: 2500,
      temperature: 0.6,
    });
    const list = Array.isArray(ai) ? ai : ai.questions;
    let questions = finalizeQuestions(Array.isArray(list) ? list : []);
    if (questions.length < Math.ceil(count * 0.7)) throw new Error("LLM returned too few valid questions");
    if (questions.length < count) {
      const have = new Set(questions.map((x) => x.text));
      const extra = offlineQuestions({ roleId, count: count * 2, profile }).filter((x) => !have.has(x.text));
      questions = finalizeQuestions([...questions, ...extra].slice(0, count));
    }
    return { questions: questions.slice(0, count), source: "ai" };
  } catch (e) {
    console.error("generateQuestions LLM failed, using offline bank:", e.message);
    return { questions: offlineQuestions({ roleId, count, profile }), source: "offline", warning: e.message };
  }
}

/* ----------------------------------------------------------------- grading */

const NO_ANSWER = /^\s*(\[no answer\]|skip(ped)?|idk|i don'?t know|n\/?a|-+)?\s*$/i;

export function offlineGrade({ expected_points = [], answer = "", difficulty = "medium" }) {
  const text = (answer || "").toLowerCase();
  const words = new Set(text.split(/\W+/).filter(Boolean).map((w) => w.replace(/(ing|ed|es|s)$/, "")));
  const matched = [];
  const missed = [];
  for (const p of expected_points) {
    const toks = String(p).toLowerCase().split(/\W+/).filter((w) => w.length > 3).map((w) => w.replace(/(ing|ed|es|s)$/, ""));
    const hit = toks.length ? toks.filter((t) => words.has(t) || text.includes(t)).length / toks.length : 0;
    (hit >= 0.5 ? matched : missed).push(p);
  }
  const coverage = expected_points.length ? matched.length / expected_points.length : 0;
  const len = (answer || "").trim().split(/\s+/).length;
  let score = coverage * 90 + Math.min(len, 60) / 60 * 10;
  if (len < 8) score *= 0.5;
  if (difficulty === "hard") score *= 0.95;
  score = clamp(score);
  return {
    score,
    feedback:
      score >= 85 ? "Excellent — you covered nearly everything with clarity."
      : score >= 70 ? "Good answer — most key points covered, a few gaps."
      : score >= 45 ? "Partial — some right ideas, but important points are missing or shallow."
      : "Weak — the answer misses most of what was expected. Review the fundamentals of this topic.",
    matched_points: matched,
    missed_points: missed,
    tip: missed[0] ? `Next time, make sure to mention: ${missed[0]}.` : "Add a concrete example to make it even stronger.",
  };
}

export async function rateAnswer({ question, answer, difficulty, expected_points = [], role: roleId }) {
  if (NO_ANSWER.test(answer || "") || (answer || "").trim().length < 4) {
    return { score: 0, feedback: "No answer was given for this question.", matched_points: [], missed_points: expected_points, tip: "Even a partial answer earns partial credit — try your best next time.", source: "rule" };
  }
  if (!llmConfigured()) return { ...offlineGrade({ expected_points, answer, difficulty }), source: "offline" };

  try {
    const ai = await llmJSON({
      system:
        `You are a fair but rigorous ${getRole(roleId).label} interviewer grading a chat answer. Judge understanding, correctness and depth — not length or polish. ` +
        "Give credit for correct points even if worded differently from the rubric, and for correct extra insight. Penalise wrong claims. Never reward padding. " +
        "Score bands: 0-40 poor/incorrect, 41-70 partial, 71-85 good, 86-100 excellent (needs correctness AND depth). Typical honest answers land 40-80.",
      user: `Question (${difficulty}): ${question}
Rubric (expected points): ${JSON.stringify(expected_points)}
Candidate answer: """${String(answer).slice(0, 3000)}"""

Return: {"score": 0-100, "feedback": "1-2 sentences addressed to the candidate: what was good, what was wrong/missing", "matched_points": string[] (rubric items covered), "missed_points": string[] (rubric items missing or wrong), "tip": "one concrete sentence on how to improve this answer"}`,
      maxTokens: 700,
      temperature: 0.1,
    });
    if (ai.score === undefined) throw new Error("no score");
    const arr = (v) => (Array.isArray(v) ? v.map(String) : []);
    return {
      score: clamp(ai.score),
      feedback: String(ai.feedback || "").slice(0, 400),
      matched_points: arr(ai.matched_points),
      missed_points: arr(ai.missed_points),
      tip: String(ai.tip || "").slice(0, 300),
      source: "ai",
    };
  } catch (e) {
    console.error("rateAnswer LLM failed, using offline grader:", e.message);
    return { ...offlineGrade({ expected_points, answer, difficulty }), source: "offline" };
  }
}

export async function getHint({ question, expected_points = [] }) {
  if (llmConfigured()) {
    try {
      const ai = await llmJSON({
        system: "You are a supportive interviewer. Give a short nudge that helps the candidate start, without revealing the answer.",
        user: `Question: ${question}\nRubric (do not reveal): ${JSON.stringify(expected_points)}\nReturn {"hint": "one sentence, max 25 words, phrased as a guiding question or prompt"}`,
        maxTokens: 150,
        temperature: 0.4,
      });
      if (ai.hint) return { hint: String(ai.hint), source: "ai" };
    } catch (e) {
      console.error("getHint failed:", e.message);
    }
  }
  const first = expected_points[0];
  return { hint: first ? `Start with the basics — think about: "${first.split(/[,(]/)[0].trim()}".` : "Break the problem down: define the concept first, then give an example.", source: "offline" };
}

/* ------------------------------------------------------------------ report */

export function recommendationFor(score, answered, total) {
  if (answered < Math.ceil(total / 2)) return "Incomplete";
  if (score >= 80) return "Strong hire";
  if (score >= 65) return "Hire";
  if (score >= 50) return "Borderline";
  return "Not yet";
}

export async function finalReport({ role: roleId, candidateName, profile = {}, answers = [] }) {
  const role = getRole(roleId);
  const totalWeight = answers.reduce((a, x) => a + (WEIGHT[x.difficulty] || 1), 0) || 1;
  const score = clamp(answers.reduce((a, x) => a + (Number(x.score) || 0) * (WEIGHT[x.difficulty] || 1), 0) / totalWeight);
  const answered = answers.filter((a) => (Number(a.score) || 0) > 0 || (a.answer && !NO_ANSWER.test(a.answer))).length;
  const recommendation = recommendationFor(score, answered, answers.length);

  const sorted = [...answers].sort((a, b) => b.score - a.score);
  const offline = {
    summary: `${candidateName || "The candidate"} scored ${score}/100 for the ${role.label} role, answering ${answered} of ${answers.length} questions. ` +
      (sorted[0] ? `Strongest area: ${sorted[0].topic || "n/a"}. ` : "") + (sorted.length > 1 ? `Weakest area: ${sorted[sorted.length - 1].topic || "n/a"}.` : ""),
    strengths: sorted.filter((a) => a.score >= 70).slice(0, 3).map((a) => `${a.topic || "Topic"} (${a.score}/100)`),
    improvements: [...sorted].reverse().filter((a) => a.score < 60).slice(0, 3).map((a) => `${a.topic || "Topic"}: ${a.missed_points?.[0] || "revise fundamentals"}`),
  };

  if (!llmConfigured()) return { score, recommendation, ...offline, source: "offline" };
  try {
    const ai = await llmJSON({
      system: "You are a hiring panel lead writing an honest, evidence-based interview debrief. Refer only to what is in the data.",
      user: `Role: ${role.label}. Candidate: ${candidateName}. Years of experience: ${profile.yearsExperience ?? "unknown"}. Overall score: ${score}/100 (${recommendation}).
Per-question results: ${JSON.stringify(answers.map((a) => ({ topic: a.topic, difficulty: a.difficulty, score: a.score, feedback: a.feedback, missed: a.missed_points })))}

Return {"summary": "3 sentences max, professional", "strengths": string[] (max 3, specific), "improvements": string[] (max 3, specific and actionable)}`,
      maxTokens: 600,
      temperature: 0.3,
    });
    return {
      score,
      recommendation,
      summary: String(ai.summary || offline.summary).slice(0, 700),
      strengths: Array.isArray(ai.strengths) && ai.strengths.length ? ai.strengths.map(String).slice(0, 4) : offline.strengths,
      improvements: Array.isArray(ai.improvements) && ai.improvements.length ? ai.improvements.map(String).slice(0, 4) : offline.improvements,
      source: "ai",
    };
  } catch (e) {
    console.error("finalReport LLM failed:", e.message);
    return { score, recommendation, ...offline, source: "offline" };
  }
}
