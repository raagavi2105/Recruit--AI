// src/utils/normalizeCandidate.js
export function normalizeCandidate({ name, email, phone, text }) {
    const safeEmail = (email || "").trim();
    const id = safeEmail || `${Date.now()}`;
    const safeName = (name || "").trim() || (safeEmail ? safeEmail.split("@")[0] : "Unknown Candidate");
    return {
      id,
      name: safeName,
      email: safeEmail || "unknown@example.com",
      phone: phone || "N/A",
      resumeText: text || "",
    };
  }
  