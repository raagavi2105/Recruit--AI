"use client";
// src/components/InterviewStudio.jsx
// Guided flow: 1) resume -> 2) role -> 3) live interview -> 4) report.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Collapse, Empty, Input, InputNumber, Progress, Select, Space, Spin, Steps, Switch, Tag, Typography, Upload, message as antdMessage } from "antd";
import {
  InboxOutlined, RobotOutlined, UserOutlined, ExperimentOutlined, BarChartOutlined, CodeOutlined, CloudOutlined,
  SafetyCertificateOutlined, BulbOutlined, ClockCircleOutlined, CheckCircleFilled, CloseCircleFilled, ThunderboltOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { useDispatch, useSelector } from "react-redux";
import { addOrUpdateCandidate, updateCandidate, addInterviewToCandidate } from "../store/slices/candidatesSlice";
import { extractTextFromFile } from "../utils/resumeParser";
import { analyzeResume } from "../lib/resumeHeuristics";
import { ROLE_LIST, getRole } from "../lib/roles";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const ROLE_ICON = {
  ai: <RobotOutlined />, ml: <ExperimentOutlined />, ds: <BarChartOutlined />,
  sde: <CodeOutlined />, cloud: <CloudOutlined />, cyber: <SafetyCertificateOutlined />,
};
export const scoreColor = (s) => (s >= 86 ? "#16a34a" : s >= 71 ? "#2563eb" : s >= 41 ? "#d97706" : "#dc2626");
const RECO_COLOR = { "Strong hire": "green", Hire: "blue", Borderline: "orange", "Not yet": "red", Incomplete: "default" };

const api = (payload) => axios.post("/api/ai", payload).then((r) => r.data);

export default function InterviewStudio() {
  const dispatch = useDispatch();
  const [message, messageHolder] = antdMessage.useMessage();
  const candidates = useSelector((s) => s.candidates.list || []);

  const [step, setStep] = useState(0);
  const [ai, setAi] = useState({ checked: false, ai: false, model: null });
  const [candidateId, setCandidateId] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [roleId, setRoleId] = useState(null);
  const [count, setCount] = useState(6);
  const [timed, setTimed] = useState(false);
  const [focus, setFocus] = useState(true);
  const [starting, setStarting] = useState(false);

  // live interview state
  const [sess, setSess] = useState(null); // { questions, index, answers, history, source }
  const [phase, setPhase] = useState("idle"); // asking | grading | reviewing | finishing
  const [draft, setDraft] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintLoading, setHintLoading] = useState(false);
  const [report, setReport] = useState(null);

  const draftRef = useRef("");
  const busyRef = useRef(false);
  const tabSwitches = useRef(0);
  const chatRef = useRef(null);
  const startedAt = useRef(null);

  const candidate = useMemo(() => candidates.find((c) => c.id === candidateId) || null, [candidates, candidateId]);
  const profile = candidate?.profile || null;
  const role = roleId ? getRole(roleId) : null;

  useEffect(() => {
    api({ action: "status" }).then((d) => setAi({ checked: true, ...d })).catch(() => setAi({ checked: true, ai: false, model: null }));
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [sess?.history, phase]);

  // tab-switch tracking while an interview is running
  useEffect(() => {
    const onHide = () => { if (document.hidden && step === 2 && phase !== "idle") tabSwitches.current += 1; };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [step, phase]);

  /* ----------------------------------------------------------- resume step */

  async function handleFile(file) {
    setParsing(true);
    try {
      const text = await extractTextFromFile(file);
      if ((text || "").trim().length < 60) throw new Error("empty");
      const quick = analyzeResume(text, { filename: file.name });
      let profileData = quick;
      let source = "offline";
      try {
        const res = await api({ action: "parse_resume", text, filename: file.name });
        profileData = res.profile;
        source = res.source;
      } catch (e) {
        console.error("parse_resume failed, using local extraction", e);
      }
      const existing = profileData.email && candidates.find((c) => (c.email || "").toLowerCase() === profileData.email.toLowerCase());
      const id = existing?.id || uuidv4();
      dispatch(addOrUpdateCandidate({
        id, name: profileData.name || "", email: profileData.email || "", phone: profileData.phone || "",
        resumeText: text, profile: profileData, profileSource: source, fileName: file.name,
      }));
      setCandidateId(id);
      setRoleId(profileData.suggestedRole || null);
      message.success(profileData.name ? `Resume read — hi ${profileData.name.split(" ")[0]}!` : "Resume read. Please confirm the name below.");
    } catch (e) {
      console.error(e);
      message.error(e.message === "empty"
        ? "Couldn't read any text from this file (scanned image?). Try a text-based PDF/DOCX or enter details manually."
        : e.message || "Failed to read resume.");
    } finally {
      setParsing(false);
    }
  }

  function manualEntry() {
    const id = uuidv4();
    dispatch(addOrUpdateCandidate({ id, name: "", email: "", phone: "", resumeText: "", profile: { skills: [], experience: [], projects: [], education: [], links: [] }, profileSource: "manual" }));
    setCandidateId(id);
  }

  const editCandidate = (updates) => dispatch(updateCandidate({ id: candidate.id, updates }));
  const editProfile = (updates) => editCandidate({ profile: { ...profile, ...updates } });

  /* ------------------------------------------------------------ interview */

  async function startInterview() {
    if (!candidate?.name?.trim()) return message.warning("Please enter the candidate's name first.");
    if (!roleId) return message.warning("Pick a role to continue.");
    setStarting(true);
    try {
      const data = await api({ action: "generate_questions", role: roleId, count, profile: profile || {}, resumeText: candidate.resumeText || "" });
      if (!data.questions?.length) throw new Error("No questions returned");
      if (ai.ai && data.source === "offline") message.warning(`AI call failed, using the built-in question bank. ${data.warning ? `(${data.warning.slice(0, 120)})` : ""}`, 8);
      if (focus) { try { await document.documentElement.requestFullscreen?.(); } catch { /* user may deny */ } }
      tabSwitches.current = 0;
      startedAt.current = Date.now();
      const first = data.questions[0];
      setSess({
        questions: data.questions, index: 0, answers: [], source: data.source,
        history: [
          { type: "system", text: `${getRole(roleId).label} interview with ${candidate.name} — ${data.questions.length} questions${data.source === "ai" ? ", tailored to your resume" : ""}. Good luck!` },
          { type: "question", q: first, n: 1 },
        ],
      });
      setDraft(""); draftRef.current = ""; setHintsUsed(0);
      setTimeLeft(first.estimated_time);
      busyRef.current = false;
      setPhase("asking");
      setStep(2);
    } catch (e) {
      console.error(e);
      message.error("Couldn't start the interview. Please try again.");
    } finally {
      setStarting(false);
    }
  }

  const submitAnswer = useCallback(async (auto = false) => {
    if (busyRef.current || !sess) return;
    busyRef.current = true;
    const q = sess.questions[sess.index];
    const text = draftRef.current.trim() || "[no answer]";
    setPhase("grading");
    setSess((s) => ({ ...s, history: [...s.history, { type: "answer", text, auto }] }));
    try {
      const rating = await api({
        action: "rate_answer", question: q.text, answer: text, difficulty: q.difficulty,
        expected_points: q.expected_points, role: roleId,
      });
      const record = { questionId: q.id, topic: q.topic, difficulty: q.difficulty, question: q.text, expected_points: q.expected_points, answer: text, hintsUsed, ...rating };
      setSess((s) => ({ ...s, answers: [...s.answers, record], history: [...s.history, { type: "feedback", rating }] }));
      setPhase("reviewing");
    } catch (e) {
      console.error("grading failed", e);
      message.error("Couldn't grade that answer — check your connection and submit again.");
      setSess((s) => ({ ...s, history: s.history.slice(0, -1) }));
      setTimeLeft((t) => Math.max(t, 30));
      setPhase("asking");
    } finally {
      busyRef.current = false;
    }
  }, [sess, roleId, hintsUsed]);

  const submitRef = useRef(submitAnswer);
  submitRef.current = submitAnswer;

  // countdown (only when timed mode is on and a question is open)
  useEffect(() => {
    if (step !== 2 || phase !== "asking" || !timed) return undefined;
    const t = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(t);
  }, [step, phase, timed, sess?.index]);

  useEffect(() => {
    if (step === 2 && phase === "asking" && timed && timeLeft <= 0) submitRef.current(true);
  }, [timeLeft, step, phase, timed]);

  function nextQuestion() {
    const nextIndex = sess.index + 1;
    if (nextIndex >= sess.questions.length) return finishInterview();
    const q = sess.questions[nextIndex];
    setSess((s) => ({ ...s, index: nextIndex, history: [...s.history, { type: "question", q, n: nextIndex + 1 }] }));
    setDraft(""); draftRef.current = ""; setHintsUsed(0);
    setTimeLeft(q.estimated_time);
    setPhase("asking");
  }

  async function finishInterview() {
    setPhase("finishing");
    try {
      const result = await api({
        action: "final_summary_and_score", role: roleId, candidateName: candidate.name, profile: profile || {},
        answers: sess.answers.map((a) => ({ topic: a.topic, difficulty: a.difficulty, score: a.score, feedback: a.feedback, missed_points: a.missed_points, answer: a.answer })),
      });
      const interview = {
        sessionId: uuidv4(), date: new Date().toISOString(), role: roleId, roleLabel: getRole(roleId).label,
        questions: sess.questions, answers: sess.answers, finalScore: result.score, summary: result.summary,
        strengths: result.strengths, improvements: result.improvements, recommendation: result.recommendation,
        tabSwitches: tabSwitches.current, durationSec: Math.round((Date.now() - startedAt.current) / 1000),
        questionSource: sess.source, gradingSource: result.source,
      };
      dispatch(addInterviewToCandidate({ candidateId: candidate.id, interview }));
      setReport(interview);
      setStep(3);
      setPhase("idle");
    } catch (e) {
      console.error(e);
      message.error("Couldn't build the report. Try again.");
      setPhase("reviewing");
    }
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ignore */ }
  }

  function abortInterview() {
    setSess(null); setPhase("idle"); setStep(1);
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* ignore */ }
  }

  async function requestHint() {
    const q = sess.questions[sess.index];
    setHintLoading(true);
    try {
      const { hint } = await api({ action: "hint", question: q.text, expected_points: q.expected_points });
      setHintsUsed((n) => n + 1);
      setSess((s) => ({ ...s, history: [...s.history, { type: "hint", text: hint }] }));
    } catch { message.error("No hint available right now."); }
    finally { setHintLoading(false); }
  }

  const blockPaste = (e) => { if (focus) { e.preventDefault(); message.warning("Pasting is disabled — please type your answer."); } };

  /* ---------------------------------------------------------------- render */

  const aiBanner = !ai.checked ? null : ai.ai ? (
    <Tag color="green" icon={<ThunderboltOutlined />}>AI live · {ai.model}</Tag>
  ) : (
    <Tag color="orange">Offline mode — add LLM_API_KEY for AI-tailored questions &amp; grading</Tag>
  );

  const stepsEl = (
    <>
    {messageHolder}
    <Steps
      size="small"
      current={step}
      style={{ marginBottom: 20 }}
      items={[{ title: "Resume" }, { title: "Role" }, { title: "Interview" }, { title: "Report" }]}
    />
    </>
  );

  /* ---- step 0 ---- */
  if (step === 0) {
    return (
      <div>
        <div className="studio-top">{stepsEl}{aiBanner}</div>
        <div className="studio-grid">
          <Card className="panel-card" variant="borderless">
            <h3 className="panel-title">1 · Upload a resume</h3>
            <Upload.Dragger multiple={false} accept=".pdf,.docx,.txt" showUploadList={false} disabled={parsing}
              beforeUpload={(f) => { handleFile(f); return false; }}>
              <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: "#2563eb" }} /></p>
              <p className="ant-upload-text">Drop a PDF / DOCX resume here, or click to browse</p>
              <p className="ant-upload-hint">We extract the name, contact, skills, experience and projects, then tailor the questions to them.</p>
            </Upload.Dragger>
            {parsing && <div style={{ textAlign: "center", marginTop: 16 }}><Spin /> <Text type="secondary" style={{ marginLeft: 8 }}>Reading resume…</Text></div>}
            <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Button onClick={manualEntry}>No resume? Enter details manually</Button>
              {candidates.length > 0 && (
                <Select
                  placeholder="…or pick a previous candidate"
                  style={{ minWidth: 240 }}
                  value={candidateId}
                  onChange={(id) => { setCandidateId(id); setRoleId(candidates.find((c) => c.id === id)?.profile?.suggestedRole || null); }}
                  options={candidates.map((c) => ({ value: c.id, label: c.name || c.email || "Unnamed" }))}
                />
              )}
            </div>
          </Card>

          <Card className="panel-card" variant="borderless">
            <h3 className="panel-title">Candidate profile</h3>
            {!candidate ? (
              <Empty description="Upload a resume to see the extracted profile" />
            ) : (
              <ProfileEditor candidate={candidate} profile={profile} onCandidate={editCandidate} onProfile={editProfile} onContinue={() => {
                if (!candidate.name?.trim()) return message.warning("Please enter a name.");
                setStep(1);
              }} />
            )}
          </Card>
        </div>
      </div>
    );
  }

  /* ---- step 1 ---- */
  if (step === 1) {
    return (
      <div>
        <div className="studio-top">{stepsEl}{aiBanner}</div>
        <Card className="panel-card" variant="borderless">
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 className="panel-title" style={{ marginBottom: 2 }}>2 · What role is {candidate?.name?.split(" ")[0] || "the candidate"} interviewing for?</h3>
              <Text type="secondary">Questions are tailored to the role and to the candidate's actual skills, projects and experience.</Text>
            </div>
            <Button type="link" onClick={() => setStep(0)}>← Back to profile</Button>
          </div>

          <div className="role-grid">
            {ROLE_LIST.map((r) => (
              <button type="button" key={r.id} className={`role-card ${roleId === r.id ? "active" : ""}`} onClick={() => setRoleId(r.id)}>
                <span className="role-icon">{ROLE_ICON[r.id]}</span>
                <span className="role-name">{r.label}</span>
                <span className="role-tag">{r.tagline}</span>
                {profile?.suggestedRole === r.id && <Tag color="purple" className="role-best">Best match for resume</Tag>}
                {profile?.alternateRole === r.id && <Tag className="role-best">Also fits</Tag>}
              </button>
            ))}
          </div>

          <div className="settings-row">
            <div><Text type="secondary">Questions</Text><br />
              <Select value={count} onChange={setCount} style={{ width: 120 }} options={[4, 6, 8, 10].map((n) => ({ value: n, label: `${n} questions` }))} />
            </div>
            <div><Text type="secondary">Timed answers</Text><br /><Switch checked={timed} onChange={setTimed} /></div>
            <div><Text type="secondary">Focus mode (fullscreen, no paste)</Text><br /><Switch checked={focus} onChange={setFocus} /></div>
            <Button type="primary" size="large" loading={starting} disabled={!roleId} onClick={startInterview} icon={<ThunderboltOutlined />}>
              {starting ? "Writing questions…" : "Start interview"}
            </Button>
          </div>
          {starting && <Alert style={{ marginTop: 16 }} type="info" showIcon message={ai.ai ? "Reading the resume and writing tailored questions…" : "Preparing questions from the built-in bank and your resume…"} />}
        </Card>
      </div>
    );
  }

  /* ---- step 2 ---- */
  if (step === 2 && sess) {
    const q = sess.questions[sess.index];
    const total = sess.questions.length;
    const answeredAvg = sess.answers.length ? Math.round(sess.answers.reduce((a, b) => a + b.score, 0) / sess.answers.length) : null;
    return (
      <div>
        <div className="studio-top">{stepsEl}{aiBanner}</div>
        <div className="studio-grid interview">
          <div>
            <div className="chat-container" ref={chatRef} style={{ minHeight: 360, maxHeight: "58vh", overflowY: "auto" }}>
              {sess.history.map((m, i) => <ChatItem key={i} m={m} />)}
              {phase === "grading" && <TypingRow label="Interviewer is reviewing your answer…" />}
              {phase === "finishing" && <TypingRow label="Preparing your report…" />}
            </div>

            {phase === "asking" && (
              <Card className="panel-card" style={{ marginTop: 14 }}>
                <TextArea rows={5} value={draft} autoFocus placeholder={focus ? "Type your answer (pasting disabled)…" : "Type your answer…"}
                  onChange={(e) => { setDraft(e.target.value); draftRef.current = e.target.value; }}
                  onPaste={blockPaste} onDrop={(e) => focus && e.preventDefault()}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submitAnswer(); }} />
                <div className="answer-bar">
                  <Space>
                    {timed && (
                      <span style={{ color: timeLeft < 15 ? "#dc2626" : "#475569", fontWeight: 700 }}>
                        <ClockCircleOutlined /> {Math.max(0, Math.floor(timeLeft / 60))}:{String(Math.max(0, timeLeft) % 60).padStart(2, "0")}
                      </span>
                    )}
                    <Text type="secondary">{draft.trim().split(/\s+/).filter(Boolean).length} words · ⌘/Ctrl+Enter to submit</Text>
                  </Space>
                  <Space>
                    <Button icon={<BulbOutlined />} loading={hintLoading} onClick={requestHint}>Hint</Button>
                    <Button onClick={() => { draftRef.current = ""; submitAnswer(); }}>Skip</Button>
                    <Button type="primary" onClick={() => submitAnswer()} disabled={!draft.trim()}>Submit answer</Button>
                  </Space>
                </div>
              </Card>
            )}

            {phase === "reviewing" && (
              <div style={{ marginTop: 14, textAlign: "right" }}>
                <Button type="primary" size="large" onClick={nextQuestion}>
                  {sess.index + 1 >= total ? "Finish & see report →" : "Next question →"}
                </Button>
              </div>
            )}
          </div>

          <div>
            <Card className="panel-card" variant="borderless">
              <div className="side-name"><UserOutlined /> {candidate.name}</div>
              <Text type="secondary">{role.label}</Text>
              <div style={{ marginTop: 14 }}>
                <Text type="secondary">Question {sess.index + 1} of {total}</Text>
                <Progress percent={Math.round((sess.answers.length / total) * 100)} showInfo={false} strokeColor={{ "0%": "#7c3aed", "100%": "#2563eb" }} />
              </div>
              <div style={{ margin: "6px 0 10px" }}>
                <Tag color={q.difficulty === "hard" ? "red" : q.difficulty === "medium" ? "orange" : "green"}>{q.difficulty}</Tag>
                <Tag>{q.topic}</Tag>
                {q.personalized && <Tag color="purple">from your resume</Tag>}
              </div>
              {answeredAvg !== null && <div>Running average: <b style={{ color: scoreColor(answeredAvg) }}>{answeredAvg}</b> / 100</div>}
              {timed && phase === "asking" && <Progress percent={Math.max(0, Math.round((timeLeft / q.estimated_time) * 100))} showInfo={false} size="small" status={timeLeft < 15 ? "exception" : "active"} style={{ marginTop: 8 }} />}
              {sess.answers.length > 0 && phase !== "grading" && phase !== "finishing" && (
                <Button type="primary" ghost block style={{ marginTop: 16 }} onClick={finishInterview}>Finish now &amp; get report</Button>
              )}
              <Button danger block style={{ marginTop: 10 }} onClick={() => abortInterview()}>Abandon (don't save)</Button>
            </Card>
            <Card className="panel-card" variant="borderless" style={{ marginTop: 12 }}>
              <Text strong>Tips</Text>
              <ul className="tips">
                <li>Lead with the direct answer, then explain why.</li>
                <li>Use a concrete example from your own work.</li>
                <li>Stuck? A hint costs nothing — it's noted in the report.</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  /* ---- step 3 ---- */
  if (step === 3 && report) {
    return (
      <div>
        <div className="studio-top">{stepsEl}{aiBanner}</div>
        <ReportView report={report} candidate={candidate} onAgain={() => { setReport(null); setSess(null); setStep(1); }} onNew={() => { setReport(null); setSess(null); setCandidateId(null); setRoleId(null); setStep(0); }} />
      </div>
    );
  }

  return null;
}

/* ============================================================== sub-views */

function ProfileEditor({ candidate, profile, onCandidate, onProfile, onContinue }) {
  const p = profile || {};
  const sourceTag = candidate.profileSource === "ai" ? <Tag color="green">AI extraction</Tag> : candidate.profileSource === "manual" ? <Tag>Manual</Tag> : <Tag color="orange">Basic extraction</Tag>;
  const nameBad = !candidate.name?.trim();
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text type="secondary">Check what we found — fix anything that's wrong.</Text>{sourceTag}
      </div>
      <div className="field-grid">
        <label>Full name<Input status={nameBad ? "error" : ""} value={candidate.name} placeholder="Full name" onChange={(e) => onCandidate({ name: e.target.value })} /></label>
        <label>Email<Input value={candidate.email} placeholder="Email" onChange={(e) => onCandidate({ email: e.target.value })} /></label>
        <label>Phone<Input value={candidate.phone} placeholder="Phone" onChange={(e) => onCandidate({ phone: e.target.value })} /></label>
        <label>Years of experience<InputNumber min={0} max={50} style={{ width: "100%" }} value={p.yearsExperience ?? undefined} placeholder="0 for fresher" onChange={(v) => onProfile({ yearsExperience: v })} /></label>
      </div>
      {p.headline && <Paragraph style={{ marginTop: 10 }}><b>{p.headline}</b></Paragraph>}
      {p.summary && <Paragraph type="secondary">{p.summary}</Paragraph>}

      <Section title="Skills">
        <Select mode="tags" value={p.skills || []} onChange={(v) => onProfile({ skills: v })} style={{ width: "100%" }} placeholder="Add skills" tokenSeparators={[","]} />
      </Section>

      {p.experience?.length > 0 && (
        <Section title="Experience">
          {p.experience.map((e, i) => (
            <div key={i} className="mini-item">
              <b>{e.title}{e.company ? ` · ${e.company}` : ""}</b> {e.duration && <Text type="secondary">({e.duration})</Text>}
              {e.highlights?.slice(0, 2).map((h, j) => <div key={j} className="mini-sub">• {h}</div>)}
            </div>
          ))}
        </Section>
      )}
      {p.projects?.length > 0 && (
        <Section title="Projects">
          {p.projects.map((x, i) => (
            <div key={i} className="mini-item"><b>{x.name}</b> {x.tech?.map((t) => <Tag key={t} style={{ marginLeft: 4 }}>{t}</Tag>)}
              {x.summary && <div className="mini-sub">{x.summary}</div>}</div>
          ))}
        </Section>
      )}
      {p.education?.length > 0 && (
        <Section title="Education">
          {p.education.map((e, i) => <div key={i} className="mini-item">{e.degree}{e.school ? ` · ${e.school}` : ""} {e.year && <Text type="secondary">({e.year})</Text>}</div>)}
        </Section>
      )}

      <Button type="primary" size="large" block style={{ marginTop: 18 }} onClick={onContinue}>Looks right — choose role →</Button>
    </div>
  );
}

const Section = ({ title, children }) => (
  <div style={{ marginTop: 14 }}><div className="sec-title">{title}</div>{children}</div>
);

function TypingRow() {
  return (
    <div className="chat-row"><div style={{ width: 56 }}><Avatar_ /></div>
      <div className="bubble-left"><span className="typing"><i /><i /><i /></span></div></div>
  );
}
const Avatar_ = () => <div className="avatar bot"><RobotOutlined /></div>;

function ChatItem({ m }) {
  if (m.type === "system") return <div className="sys-msg">{m.text}</div>;
  if (m.type === "question") {
    return (
      <div className="chat-row"><div style={{ width: 56 }}><Avatar_ /></div>
        <div className="bubble-left">
          <div className="bubble-meta">Question {m.n} · {m.q.difficulty} · {m.q.topic}{m.q.personalized ? " · from your resume" : ""}</div>
          <div className="q-text">{m.q.text}</div>
        </div></div>
    );
  }
  if (m.type === "hint") return <div className="hint-msg"><BulbOutlined /> {m.text}</div>;
  if (m.type === "answer") {
    return (
      <div className="chat-row" style={{ justifyContent: "flex-end" }}>
        <div className="bubble-right"><div className="bubble-meta">You{m.auto ? " · time's up" : ""}</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{m.text === "[no answer]" ? <i>No answer</i> : m.text}</div></div>
      </div>
    );
  }
  if (m.type === "feedback") {
    const r = m.rating;
    return (
      <div className="feedback-card" style={{ borderColor: scoreColor(r.score) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Feedback</b><b style={{ color: scoreColor(r.score), fontSize: 18 }}>{r.score}/100</b>
        </div>
        <div style={{ margin: "6px 0" }}>{r.feedback}</div>
        {r.matched_points?.length > 0 && <div className="pts">{r.matched_points.map((p) => <div key={p}><CheckCircleFilled style={{ color: "#16a34a" }} /> {p}</div>)}</div>}
        {r.missed_points?.length > 0 && <div className="pts">{r.missed_points.map((p) => <div key={p}><CloseCircleFilled style={{ color: "#dc2626" }} /> {p}</div>)}</div>}
        {r.tip && <div className="tip"><BulbOutlined /> {r.tip}</div>}
      </div>
    );
  }
  return null;
}

function ReportView({ report, candidate, onAgain, onNew }) {
  const mins = Math.max(1, Math.round((report.durationSec || 0) / 60));
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card className="panel-card" variant="borderless">
        <div className="report-head">
          <Progress type="circle" percent={report.finalScore} strokeColor={scoreColor(report.finalScore)} format={(p) => <span style={{ fontWeight: 800 }}>{p}</span>} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <Title level={3} style={{ margin: 0 }}>{candidate?.name} · {report.roleLabel}</Title>
            <div style={{ margin: "6px 0 10px" }}>
              <Tag color={RECO_COLOR[report.recommendation] || "default"} style={{ fontSize: 14, padding: "2px 10px" }}>{report.recommendation}</Tag>
              <Tag>{report.answers.length} questions</Tag><Tag>{mins} min</Tag>
              {report.tabSwitches > 0 && <Tag color="red">{report.tabSwitches} tab switch{report.tabSwitches > 1 ? "es" : ""}</Tag>}
              <Tag color={report.gradingSource === "ai" ? "green" : "orange"}>{report.gradingSource === "ai" ? "AI graded" : "Rule-based grading"}</Tag>
            </div>
            <Paragraph style={{ marginBottom: 0 }}>{report.summary}</Paragraph>
          </div>
        </div>
        <div className="two-col">
          <div><div className="sec-title">Strengths</div>{report.strengths?.length ? report.strengths.map((s) => <div key={s}><CheckCircleFilled style={{ color: "#16a34a" }} /> {s}</div>) : <Text type="secondary">None stood out yet.</Text>}</div>
          <div><div className="sec-title">To improve</div>{report.improvements?.length ? report.improvements.map((s) => <div key={s}><CloseCircleFilled style={{ color: "#d97706" }} /> {s}</div>) : <Text type="secondary">Nothing major.</Text>}</div>
        </div>
      </Card>

      <Card className="panel-card" variant="borderless" title="Question by question">
        <Collapse items={report.answers.map((a, i) => ({
          key: i,
          label: <span><b style={{ color: scoreColor(a.score) }}>{a.score}</b> · Q{i + 1} · {a.topic} <Tag style={{ marginLeft: 6 }}>{a.difficulty}</Tag></span>,
          children: (
            <div>
              <b>{a.question}</b>
              <Paragraph style={{ margin: "8px 0", whiteSpace: "pre-wrap" }} type="secondary">{a.answer === "[no answer]" ? "No answer given." : a.answer}</Paragraph>
              <div>{a.feedback}</div>
              {a.matched_points?.map((p) => <div key={p}><CheckCircleFilled style={{ color: "#16a34a" }} /> {p}</div>)}
              {a.missed_points?.map((p) => <div key={p}><CloseCircleFilled style={{ color: "#dc2626" }} /> {p}</div>)}
              {a.tip && <div className="tip"><BulbOutlined /> {a.tip}</div>}
            </div>
          ),
        }))} />
      </Card>

      <Space>
        <Button type="primary" onClick={onAgain}>Interview for another role</Button>
        <Button onClick={onNew}>New candidate</Button>
      </Space>
    </div>
  );
}
