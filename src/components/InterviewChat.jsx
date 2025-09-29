// src/components/InterviewChat.jsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { Button, Input, Card, Modal, Select, Avatar, Typography, Progress, Space } from "antd";
import { RobotOutlined, UserOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { startSession, updateCurrent, finishSession } from "../store/slices/interviewSlice";
import { addInterviewToCandidate } from "../store/slices/candidatesSlice";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;
const TIMER_MAP = { easy: 20, medium: 60, hard: 120 };

export default function InterviewChat() {
  const dispatch = useDispatch();
  const candidates = useSelector((s) => s.candidates.list || []);
  const interview = useSelector((s) => s.interview.current);

  const [selectedId, setSelectedId] = useState(candidates[0]?.id || "");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => setMessages(interview?.messages || []), [interview]);
  useEffect(() => () => clearInterval(timerRef.current), []);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages]);

  function preventPaste(e) {
    e.preventDefault();
    Modal.info({ title: "Pasting disabled", content: "Please type answers to keep evaluations honest." });
  }

  async function generateQuestions(role = "Full Stack (React/Node)", resumeText = "") {
    try {
      const res = await axios.post("/api/ai", { action: "generate_questions", role, resumeText });
      return res.data.questions || [];
    } catch (e) {
      console.error("generateQuestions failed", e);
      // fallback short list
      return [
        { id: 0, difficulty: "easy", text: "Explain JS closures.", expected_points: ["scope", "closure"], estimated_time: 20 },
        { id: 1, difficulty: "easy", text: "REST vs GraphQL - one clear difference.", expected_points: ["request shape"], estimated_time: 20 },
        { id: 2, difficulty: "medium", text: "How to secure an Express API?", expected_points: ["auth", "validation", "rate-limit"], estimated_time: 60 },
        { id: 3, difficulty: "medium", text: "Why React keys matter for lists?", expected_points: ["identity", "reconciliation"], estimated_time: 60 },
        { id: 4, difficulty: "hard", text: "Prevent memory leaks in Node.js — give 4 steps.", expected_points: ["profiling", "listeners", "gc", "refs"], estimated_time: 120 },
        { id: 5, difficulty: "hard", text: "Optimize React renders: list 4 techniques.", expected_points: ["memo", "useMemo", "windowing", "pure"], estimated_time: 120 },
      ];
    }
  }

  async function startInterviewForCandidateById(candidateId) {
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) {
      Modal.warning({ title: "Select candidate", content: "Please upload/select a candidate first." });
      return;
    }

    // ensure candidate has a sensible name
    if (!candidate.name || candidate.name.trim() === "" || candidate.name === "Unknown Candidate") {
      let nameValue = "";
      await new Promise((resolve) => {
        Modal.confirm({
          title: "Candidate name missing",
          content: <Input onChange={(e) => (nameValue = e.target.value)} placeholder="Full name" />,
          onOk: () => {
            if (!nameValue?.trim()) {
              Modal.error({ title: "Name required" });
              resolve();
              return;
            }
            dispatch({ type: "candidates/updateCandidate", payload: { id: candidate.id, updates: { name: nameValue.trim() } } });
            setSelectedId(candidate.id);
            resolve();
          },
          onCancel: () => resolve(),
        });
      });
    }

    // fullscreen for focus (best-effort)
    try {
      await document.documentElement.requestFullscreen?.();
    } catch (e) {}

    const questions = await generateQuestions("Full Stack (React/Node)", candidate.resumeText || "");
    const session = {
      sessionId: uuidv4(),
      candidateId: candidate.id,
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      questions,
      currentIndex: 0,
      messages: [{ type: "system", text: "Interview started" }],
      answers: [],
      status: "in_progress",
    };

    dispatch(startSession(session));
    startQuestionFlow(session);
  }

  function startQuestionFlow(sessionObj) {
    const s = sessionObj || interview;
    if (!s) return;
    const idx = s.currentIndex || 0;
    if (idx >= (s.questions || []).length) return finalizeSession(s);
    const q = s.questions[idx];

    const message = { type: "question", id: q.id, difficulty: q.difficulty, text: q.text, estimated_time: q.estimated_time };
    const newMessages = [...(s.messages || []), message];
    const newSession = { ...s, messages: newMessages };
    dispatch(updateCurrent(newSession));
    setMessages(newMessages);
    setDraft("");
    startTimer(q.estimated_time || TIMER_MAP[q.difficulty] || 30);
  }

  function startTimer(seconds) {
    clearInterval(timerRef.current);
    setTimeLeft(seconds || 30);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleAutoSubmit() {
    await submitAnswer(draft || "[no answer]");
  }

  async function submitAnswer(text) {
    if (!interview) return;
    setIsSubmitting(true);
    clearInterval(timerRef.current);

    const idx = interview.currentIndex || 0;
    const q = interview.questions[idx];

    // show candidate answer
    const answerMessage = { type: "answer", questionId: q.id, text };
    const newMessages = [...(interview.messages || []), answerMessage];
    const localSession = { ...interview, messages: newMessages };
    dispatch(updateCurrent(localSession));
    setMessages(newMessages);
    setDraft("");

    try {
      const resp = await axios.post("/api/ai", {
        action: "rate_answer",
        question: q.text,
        answer: text,
        difficulty: q.difficulty,
        expected_points: q.expected_points || [],
      });

      const rating = resp.data;
      // ensure rating.score is numeric and capped 0-100
      rating.score = Math.max(0, Math.min(100, Number(rating.score || 0)));

      const answerObj = { questionId: q.id, text, rating };
      const newAnswers = [...(interview.answers || []), answerObj];

      const newSession = {
        ...interview,
        answers: newAnswers,
        messages: newMessages,
        currentIndex: (interview.currentIndex || 0) + 1,
      };

      dispatch(updateCurrent(newSession));
      setMessages(newMessages);

      if (newSession.currentIndex >= (newSession.questions || []).length) {
        await finalizeSession(newSession);
      } else {
        startQuestionFlow(newSession);
      }
    } catch (err) {
      console.error("grading failed", err);
      // fallback: call rate_answer (which itself has fallback)
      try {
        const fallback = await axios.post("/api/ai", {
          action: "rate_answer",
          question: q.text,
          answer: text,
          difficulty: q.difficulty,
          expected_points: q.expected_points || [],
        });
        const rating = fallback.data;
        rating.score = Math.max(0, Math.min(100, Number(rating.score || 0)));
        const answerObj = { questionId: q.id, text, rating };
        const newAnswers = [...(interview.answers || []), answerObj];
        const newSession = { ...interview, answers: newAnswers, messages: newMessages, currentIndex: (interview.currentIndex || 0) + 1 };
        dispatch(updateCurrent(newSession));
        setMessages(newMessages);
        if (newSession.currentIndex >= (newSession.questions || []).length) await finalizeSession(newSession);
        else startQuestionFlow(newSession);
      } catch (e) {
        Modal.error({ title: "Error", content: "Grading failed. Please try again later." });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function finalizeSession(s) {
    try {
      const resp = await axios.post("/api/ai", { action: "final_summary_and_score", session: s });
      const final = resp.data;
      const score = Math.max(0, Math.min(100, Number(final.score || 0)));
      dispatch(finishSession({ sessionId: s.sessionId, finalScore: score, summary: final.summary }));
      dispatch(addInterviewToCandidate({ candidateId: s.candidateId, interview: { ...s, finalScore: score, summary: final.summary } }));
      Modal.info({ title: "Interview finished", content: <div><b>Score:</b> {score} / 100<br/>{final.summary}</div> });
      try { await document.exitFullscreen?.(); } catch (e) {}
    } catch (err) {
      console.error("finalize error", err);
      const avg = Math.round((s.answers.reduce((a, b) => a + (b.rating?.score || 0), 0)) / Math.max(1, s.answers.length));
      const finalScore = Math.max(0, Math.min(100, avg));
      dispatch(finishSession({ sessionId: s.sessionId, finalScore, summary: "Mock summary" }));
      dispatch(addInterviewToCandidate({ candidateId: s.candidateId, interview: { ...s, finalScore, summary: "Mock summary" } }));
      Modal.info({ title: "Interview finished (mock)", content: `Score: ${finalScore} / 100` });
      try { await document.exitFullscreen?.(); } catch (e) {}
    }
  }

  function renderMessage(m, i) {
    if (m.type === "question") {
      return (
        <div key={i} className="chat-row">
          <div style={{ width: 72 }}>
            <Avatar size={56} icon={<RobotOutlined />} style={{ background: "#eef2ff", fontSize: 20 }} />
          </div>
          <div className="bubble-left">
            <div style={{ fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
              Interviewer <span style={{ fontSize: 16 }}>🤖</span>
            </div>
            <div style={{ marginTop: 8 }}>{m.text}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>{(m.difficulty || "").toUpperCase()} • {m.estimated_time || 60}s</div>
          </div>
        </div>
      );
    }
    if (m.type === "answer") {
      return (
        <div key={i} className="chat-row" style={{ justifyContent: "flex-end" }}>
          <div className="bubble-right" style={{ textAlign: "right" }}>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Candidate <span style={{ fontSize: 16 }}>🙂</span></div>
              <Avatar size={40} icon={<UserOutlined />} style={{ background: "#fff7e6" }} />
            </div>
            <Paragraph style={{ marginTop: 8 }}>{m.text}</Paragraph>
          </div>
        </div>
      );
    }
    if (m.type === "system") {
      return (
        <div key={i} style={{ textAlign: "center", color: "#6b7280", marginBottom: 16 }}>
          {m.text}
        </div>
      );
    }
    return null;
  }

  return (
    <div style={{ display: "flex", gap: 20 }}>
      {/* Left: chat */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Interview</Title>
            <div style={{ color: "#6b7280" }}>Focused chat — answer in your own words. Copy/paste is disabled.</div>
          </div>

          <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 6 }}>
            <Progress percent={Math.round(((interview?.currentIndex || 0) / Math.max(1, (interview?.questions?.length || 6))) * 100)} showInfo={false} strokeColor={{ "0%": "#7c3aed", "100%": "#2563eb" }} />
            <div style={{ textAlign: "right", color: "#6b7280", fontSize: 13 }}>{(interview?.currentIndex || 0)} / {(interview?.questions?.length || 6)}</div>
          </div>
        </div>

        <div className="chat-container" ref={containerRef}>
          {messages.length === 0 && <div className="empty-chat">No interview active. Select a candidate and press Start.</div>}
          {messages.map((m, i) => renderMessage(m, i))}
        </div>

        {interview?.status === "in_progress" && (
          <Card style={{ marginTop: 16 }} className="panel-card">
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <TextArea rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your answer (pasting disabled)..." onPaste={preventPaste} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                  <div style={{ color: timeLeft < 10 ? "#ff4d4f" : "#081124", fontWeight: 700 }}>Time left: {timeLeft}s</div>
                  <Space>
                    <Button onClick={() => submitAnswer(draft)} loading={isSubmitting} type="primary">Submit now</Button>
                  </Space>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Right rail */}
      <div style={{ width: 360 }}>
        <Card className="panel-card" bordered={false} style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Candidate</div>
            <Select
              showSearch
              placeholder="Select candidate"
              value={selectedId}
              onChange={(v) => setSelectedId(v)}
              style={{ width: "100%", marginTop: 8 }}
              filterOption={(input, option) => (option?.children || "").toLowerCase().includes((input || "").toLowerCase())}
            >
              {candidates.map((c) => <Select.Option key={c.id} value={c.id}>{c.name || c.email || c.id}</Select.Option>)}
            </Select>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <Button type="primary" block onClick={() => startInterviewForCandidateById(selectedId)}>Start Interview</Button>
            <Button block onClick={() => {
              if (interview?.status === "in_progress") {
                Modal.confirm({ title: "Abort interview?", onOk: () => dispatch({ type: "interview/clearCurrent" }) });
              }
            }}>Abort</Button>
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>Session</div>
            <div>
              <strong>{interview?.candidateName || "-"}</strong>
              <div style={{ color: "#6b7280", marginTop: 6 }}>{interview?.candidateEmail || ""}</div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ color: "#6b7280" }}>Status: <strong>{interview?.status || "idle"}</strong></div>
              <div style={{ color: "#6b7280", marginTop: 6 }}>Questions: <strong>{(interview?.questions?.length || 6)}</strong></div>
            </div>
          </div>
        </Card>

        <Card className="panel-card" bordered={false}>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>Quick tips</div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li style={{ marginBottom: 6 }}>Answer within the time limit.</li>
            <li style={{ marginBottom: 6 }}>No copy/paste — responses must be typed.</li>
            <li style={{ marginBottom: 6 }}>You’ll get a fair, rubric-driven assessment.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
