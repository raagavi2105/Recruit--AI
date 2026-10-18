// src/app/page.tsx
"use client";

import React from "react";
import { Tabs, Typography } from "antd";
import InterviewStudio from "../components/InterviewStudio";
import Dashboard from "../components/Dashboard";

const { Title, Text } = Typography;

export default function Home() {
  const items = [
    { key: "interview", label: "Interview Studio", children: <InterviewStudio /> },
    { key: "dashboard", label: "Recruiter Dashboard", children: <Dashboard /> },
  ];

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 8 }}>
        <Title level={2} className="hero-title" style={{ marginBottom: 4 }}>RecruitAI</Title>
        <Text type="secondary">Upload a resume, pick a role, and get a tailored, AI-graded interview with a full report.</Text>
      </div>
      <Tabs defaultActiveKey="interview" items={items} />
    </div>
  );
}
