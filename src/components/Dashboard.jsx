// src/components/Dashboard.jsx
"use client";

import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Card, Collapse, Empty, Input, Popconfirm, Progress, Table, Tag, Typography } from "antd";
import { removeCandidate } from "../store/slices/candidatesSlice";
import { scoreColor } from "./InterviewStudio";

const { Text, Paragraph } = Typography;
const RECO_COLOR = { "Strong hire": "green", Hire: "blue", Borderline: "orange", "Not yet": "red", Incomplete: "default" };

const best = (c) => {
  const s = (c.interviews || []).map((i) => i.finalScore).filter((n) => typeof n === "number");
  return s.length ? Math.max(...s) : null;
};
const latest = (c) => (c.interviews || [])[(c.interviews || []).length - 1];

export default function Dashboard() {
  const dispatch = useDispatch();
  const candidates = useSelector((s) => s.candidates.list || []);
  const [search, setSearch] = useState("");

  const q = search.toLowerCase();
  const rows = candidates
    .map((c) => ({ ...c, topScore: best(c), last: latest(c) }))
    .filter((c) => [c.name, c.email, ...(c.profile?.skills || [])].some((v) => (v || "").toLowerCase().includes(q)))
    .sort((a, b) => (b.topScore ?? -1) - (a.topScore ?? -1));

  const columns = [
    {
      title: "Candidate", key: "name",
      render: (_, r) => (<div><b>{r.name || "Unnamed"}</b><div style={{ color: "#6b7280", fontSize: 12 }}>{r.email}</div></div>),
    },
    { title: "Latest role", key: "role", render: (_, r) => r.last?.roleLabel || <Text type="secondary">—</Text> },
    { title: "Verdict", key: "reco", render: (_, r) => r.last ? <Tag color={RECO_COLOR[r.last.recommendation]}>{r.last.recommendation}</Tag> : <Tag>No interview</Tag> },
    { title: "Interviews", key: "n", render: (_, r) => (r.interviews || []).length },
    {
      title: "Best score", key: "top", sorter: (a, b) => (a.topScore ?? -1) - (b.topScore ?? -1),
      render: (_, r) => (r.topScore === null ? <Tag>-</Tag> : <div style={{ width: 130 }}><Progress percent={r.topScore} size="small" strokeColor={scoreColor(r.topScore)} format={(p) => `${p}`} /></div>),
    },
  ];

  const detail = (c) => (
    <div style={{ padding: "4px 8px" }}>
      <div style={{ color: "#6b7280", marginBottom: 6 }}>{c.email} {c.phone ? `• ${c.phone}` : ""} {c.profile?.yearsExperience != null ? `• ${c.profile.yearsExperience} yrs exp` : ""}</div>
      <div style={{ marginBottom: 8 }}>{(c.profile?.skills || []).map((s) => <Tag key={s}>{s}</Tag>)}</div>
      {c.profile?.summary && <Paragraph type="secondary">{c.profile.summary}</Paragraph>}
      {!(c.interviews || []).length ? <Text type="secondary">No interviews yet.</Text> : (
        <Collapse accordion items={[...c.interviews].reverse().map((it, idx) => ({
          key: it.sessionId || idx,
          label: (
            <span>
              {it.roleLabel || "Interview"} · <b style={{ color: scoreColor(it.finalScore) }}>{it.finalScore}/100</b>{" "}
              <Tag color={RECO_COLOR[it.recommendation]}>{it.recommendation}</Tag>
              <Text type="secondary">{it.date ? new Date(it.date).toLocaleString() : ""}</Text>
              {it.tabSwitches > 0 && <Tag color="red" style={{ marginLeft: 6 }}>{it.tabSwitches} tab switches</Tag>}
            </span>
          ),
          children: (
            <div>
              <Paragraph>{it.summary}</Paragraph>
              {it.strengths?.length > 0 && <div><b>Strengths:</b> {it.strengths.join(" · ")}</div>}
              {it.improvements?.length > 0 && <div style={{ marginBottom: 10 }}><b>To improve:</b> {it.improvements.join(" · ")}</div>}
              {(it.answers || []).map((a, i) => (
                <Card type="inner" key={i} style={{ marginBottom: 8 }} size="small">
                  <b>Q{i + 1} ({a.difficulty}, {a.topic}): {a.question}</b>
                  <div style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>{a.answer === "[no answer]" ? <i>No answer</i> : a.answer}</div>
                  <Tag color={a.score >= 71 ? "green" : a.score >= 41 ? "orange" : "red"}>{a.score}/100</Tag>
                  <Text type="secondary">{a.feedback}</Text>
                  {a.missed_points?.length > 0 && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Missed: {a.missed_points.join("; ")}</div>}
                </Card>
              ))}
            </div>
          ),
        }))} />
      )}
      <Popconfirm title="Remove this candidate and their interviews?" onConfirm={() => dispatch(removeCandidate(c.id))}>
        <Button danger size="small" style={{ marginTop: 12 }}>Remove candidate</Button>
      </Popconfirm>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <Text type="secondary">Candidates ranked by best score. Search by name, email or skill.</Text>
        <Input.Search placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 320 }} allowClear />
      </div>
      <Card className="panel-card" variant="borderless">
        {rows.length === 0 ? <Empty description="No candidates yet — run an interview first" /> : (
          <Table dataSource={rows} columns={columns} rowKey="id" pagination={{ pageSize: 8 }} expandable={{ expandedRowRender: detail }} />
        )}
      </Card>
    </div>
  );
}
