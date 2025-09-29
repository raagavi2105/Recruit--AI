// src/components/Dashboard.jsx
"use client";

import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Table, Input, Card, Typography, Tag, Progress, Collapse, Empty } from "antd";

const { Title, Text } = Typography;
const { Panel } = Collapse;

/**
 * Return highest numeric finalScore for a candidate or null
 */
function highestScore(candidate) {
  if (!candidate?.interviews?.length) return null;
  const scores = candidate.interviews
    .map((it) => (typeof it.finalScore === "number" ? Math.max(0, Math.min(100, it.finalScore)) : null))
    .filter((s) => s !== null);
  if (!scores.length) return null;
  return Math.max(...scores);
}

export default function Dashboard() {
  const candidates = useSelector((s) => s.candidates.list || []);
  const [search, setSearch] = useState("");

  // prepare rows, compute topScore and filter/sort
  const rows = candidates
    .map((c) => ({ ...c, topScore: highestScore(c) }))
    .filter(
      (c) =>
        (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.email || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (b.topScore ?? -1) - (a.topScore ?? -1));

  const columns = [
    {
      title: "Candidate",
      dataIndex: "name",
      key: "name",
      render: (_, rec) => (
        <div>
          <div style={{ fontWeight: 700 }}>{rec.name}</div>
          <div style={{ color: "#6b7280", fontSize: 12 }}>{rec.email}</div>
        </div>
      ),
    },
    {
      title: "Interviews",
      dataIndex: "interviews",
      key: "interviews",
      render: (_, r) => <Text type="secondary">{(r.interviews || []).length}</Text>,
    },
    {
      title: "Top score",
      key: "top",
      render: (_, r) => {
        const s = r.topScore;
        if (s === null || s === undefined) return <Tag>-</Tag>;
        const capped = Math.max(0, Math.min(100, Math.round(s)));
        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 140 }}>
              <Progress percent={capped} size="small" showInfo={false} />
            </div>
            <div style={{ fontWeight: 700, marginTop: 6 }}>{capped} / 100</div>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Interviewer Dashboard
          </Title>
          <Text type="secondary">Candidates ordered by best performance (strict rubric).</Text>
        </div>
        <div>
          <Input.Search
            placeholder="Search candidates or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 360 }}
            allowClear
          />
        </div>
      </div>

      <Card className="panel-card" bordered={false} style={{ marginBottom: 18 }}>
        {rows.length === 0 ? (
          <Empty description="No candidates" />
        ) : (
          <Table dataSource={rows} columns={columns} rowKey="id" pagination={{ pageSize: 8 }} />
        )}
      </Card>

      <Title level={5}>Detailed candidate cards</Title>
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {rows.map((c) => {
          const topScore = c.topScore !== null && c.topScore !== undefined ? Math.max(0, Math.min(100, Math.round(c.topScore))) : null;
          // show interviews newest-first but label sessions 1..N (1 = most recent)
          const interviewsReversed = (c.interviews || []).slice().reverse();

          return (
            <Card key={c.id} className="candidate-card">
              <div style={{ width: 72 }}>
                <div
                  style={{
                    height: 56,
                    width: 56,
                    borderRadius: 8,
                    background: "linear-gradient(90deg,#7c3aed22,#2563eb22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 18,
                  }}
                >
                  {(c.name || "?").slice(0, 1).toUpperCase()}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{c.name}</div>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      {c.email} • {c.phone || "-"}
                    </div>
                    <div style={{ marginTop: 8, color: "#6b7280" }}>
                      {(c.resumeText || "").slice(0, 220)}
                      {(c.resumeText || "").length > 220 ? "…" : ""}
                    </div>
                  </div>

                  <div style={{ minWidth: 140, textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Best score</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{topScore ?? "-"}</div>
                    <div style={{ marginTop: 8 }}>
                      <Progress percent={topScore ?? 0} size="small" />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  {!interviewsReversed.length ? (
                    <div style={{ color: "#6b7280" }}>No interviews yet</div>
                  ) : (
                    <Collapse accordion>
                      {interviewsReversed.map((it, idx) => {
                        // idx 0 is most recent -> label Session 1
                        const sessionNumber = idx + 1;
                        const score = typeof it.finalScore === "number" ? Math.max(0, Math.min(100, Math.round(it.finalScore))) : "-";
                        return (
                          <Panel
                            key={it.sessionId || `${c.id}-${idx}`}
                            header={
                              <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                                <div>Session {sessionNumber}</div>
                                <div>{score} / 100</div>
                              </div>
                            }
                          >
                            <div style={{ marginBottom: 8 }}>
                              <strong>Summary:</strong> {it.summary || "-"}
                            </div>

                            {(it.questions || []).map((q, qi) => {
                              const ans = (it.answers || []).find((a) => a.questionId === q.id) || {};
                              const ansScore = typeof ans.rating?.score === "number" ? Math.max(0, Math.min(100, Math.round(ans.rating.score))) : null;
                              return (
                                <Card type="inner" key={q.id} style={{ marginBottom: 12 }}>
                                  <div style={{ fontWeight: 700 }}>Q{qi + 1} ({q.difficulty}): {q.text}</div>

                                  <div style={{ marginTop: 8 }}>
                                    <strong>Expected:</strong>
                                    <ul style={{ marginTop: 6 }}>
                                      {(q.expected_points || []).map((p, i) => (
                                        <li key={i} style={{ fontSize: 13 }}>{p}</li>
                                      ))}
                                    </ul>
                                  </div>

                                  <div style={{ marginTop: 8 }}>
                                    <strong>Answer:</strong>
                                    <div style={{ marginTop: 6, color: "#111" }}>{ans.text || "(none)"}</div>
                                  </div>

                                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
                                    <div><strong>Rating:</strong></div>
                                    <Tag
                                      color={ansScore === null ? "default" : (ansScore >= 86 ? "green" : ansScore >= 71 ? "blue" : ansScore >= 41 ? "orange" : "red")}
                                    >
                                      {ansScore ?? "-"} / 100
                                    </Tag>
                                    <div style={{ color: "#6b7280", marginLeft: 8 }}><strong>Feedback:</strong> {ans.rating?.feedback || "-"}</div>
                                  </div>
                                </Card>
                              );
                            })}
                          </Panel>
                        );
                      })}
                    </Collapse>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
