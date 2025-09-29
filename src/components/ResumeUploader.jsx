// src/components/ResumeUploader.jsx
"use client";
import React, { useState } from "react";
import { Upload, Button, message, Card } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { parsePDF, parseDocx, extractContactInfo } from "../utils/resumeParser";
import { useDispatch } from "react-redux";
import { addOrUpdateCandidate } from "../store/slices/candidatesSlice";

const { Dragger } = Upload;

export default function ResumeUploader() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  const props = {
    multiple: false,
    accept: ".pdf,.docx",
    customRequest: ({ file, onSuccess }) => setTimeout(() => onSuccess("ok"), 0),
    onChange: async (info) => {
      const file = info.file.originFileObj;
      setLoading(true);
      try {
        let text = "";
        if (file.name.toLowerCase().endsWith(".pdf")) text = await parsePDF(file);
        else if (file.name.toLowerCase().endsWith(".docx")) text = await parseDocx(file);
        else throw new Error("Unsupported file type");
        const extracted = extractContactInfo(text);

        const candidatePayload = {
          name: extracted.name || (extracted.email ? extracted.email.split("@")[0] : "Unknown Candidate"),
          email: extracted.email,
          phone: extracted.phone,
          resumeText: extracted.text
        };
        dispatch(addOrUpdateCandidate(candidatePayload));
        message.success("Resume parsed and candidate added.");
      } catch (e) {
        console.error(e);
        message.error("Failed to parse resume. Try another file.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Card bordered={false}>
      <Dragger {...props} style={{ padding: 18 }}>
        <p className="ant-upload-drag-icon"><InboxOutlined style={{ fontSize: 32, color: "#2563eb" }} /></p>
        <p className="ant-upload-text" style={{ fontWeight: 700 }}>Click or drop a PDF / DOCX resume</p>
        <p className="ant-upload-hint" style={{ color: "#6b7280" }}>We extract Name, Email and Phone and optionally use resume text to personalize one question.</p>
        <Button loading={loading} style={{ marginTop: 8 }}>Upload</Button>
      </Dragger>
    </Card>
  );
}
