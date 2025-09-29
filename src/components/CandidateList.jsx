// src/components/CandidateList.jsx
"use client";
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Table, Modal, Button } from "antd";

export default function CandidateList() {
  const candidates = useSelector((s) => s.candidates.list || []);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const columns = [
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Email", dataIndex: "email", key: "email" },
    { title: "Phone", dataIndex: "phone", key: "phone" },
    { title: "Actions", key: "actions", render: (_, r) => <Button onClick={() => { setSelected(r); setOpen(true); }}>View</Button> }
  ];

  return (
    <>
      <Table dataSource={candidates} columns={columns} rowKey="id" pagination={{ pageSize: 6 }} />
      <Modal open={open} onCancel={() => setOpen(false)} footer={null}>
        {selected && (
          <div>
            <h3>{selected.name}</h3>
            <div><strong>Email:</strong> {selected.email}</div>
            <div style={{ marginTop: 8 }}><strong>Interviews:</strong></div>
            {(selected.interviews || []).map(it => (
              <div key={it.sessionId} style={{ padding: 8, borderTop: "1px solid #eee" }}>
                <div><strong>Score:</strong> {it.finalScore ?? "-"}</div>
                <div style={{ marginTop: 6 }}>{it.summary}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
