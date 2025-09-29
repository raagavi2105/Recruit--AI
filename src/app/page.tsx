// src/app/page.tsx
"use client";

import React from "react";
import { Row, Col, Card, Tabs, Typography } from "antd";
import ResumeUploader from "../components/ResumeUploader";
import InterviewChat from "../components/InterviewChat";
import Dashboard from "../components/Dashboard";

const { Title, Text } = Typography;

export default function Home() {
  const items = [
    {
      key: "interview",
      label: "Interviewee (Chat)",
      children: (
        <Row gutter={[20, 20]}>
          <Col xs={24}>
            <Card className="hero-card" bordered={false}>
              <div className="hero-content">
                <div>
                  <Title level={2} className="hero-title">RecruitAI- an AI Interview Assistant</Title>
                  <Text type="secondary" className="hero-sub">Next-generation interview experience for developers — fast, fair, focused.</Text>
                </div>
                <div>
                  <button className="primary-cta" onClick={() => document.querySelector("#interview-panel")?.scrollIntoView({ behavior: "smooth" })}>
                    Start an interview
                  </button>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={7}>
            <Card className="panel-card" bordered={false}>
              <h3 className="panel-title">Resume Upload</h3>
              <ResumeUploader />
            </Card>
          </Col>

          <Col xs={24} lg={17}>
            <Card id="interview-panel" className="panel-card large" bordered={false}>
              <InterviewChat />
            </Card>
          </Col>
        </Row>
      )
    },
    {
      key: "dashboard",
      label: "Interviewer (Dashboard)",
      children: (
        <div>
          <Dashboard />
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: 28 }}>
      <Tabs defaultActiveKey="interview" items={items} />
    </div>
  );
}
