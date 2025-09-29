// src/store/slices/candidatesSlice.js
import { createSlice } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

const initialState = {
  list: [], // { id, name, email, phone, resumeText, interviews: [] }
};

const slice = createSlice({
  name: "candidates",
  initialState,
  reducers: {
    addOrUpdateCandidate(state, action) {
      const payload = action.payload || {};
      const email = (payload.email || "").toLowerCase().trim();
      let idx = -1;
      if (email) idx = state.list.findIndex((c) => (c.email || "").toLowerCase() === email);
      if (idx === -1 && payload.id) idx = state.list.findIndex((c) => c.id === payload.id);
      if (idx >= 0) {
        state.list[idx] = { ...state.list[idx], ...payload };
      } else {
        const candidate = { id: payload.id || uuidv4(), interviews: [], ...payload };
        state.list.push(candidate);
      }
    },
    updateCandidate(state, action) {
      const { id, updates } = action.payload;
      const i = state.list.findIndex((c) => c.id === id);
      if (i >= 0) state.list[i] = { ...state.list[i], ...updates };
    },
    addInterviewToCandidate(state, action) {
      const { candidateId, interview } = action.payload;
      const c = state.list.find((x) => x.id === candidateId);
      if (c) {
        c.interviews = c.interviews || [];
        c.interviews.push(interview);
      }
    },
    removeCandidate(state, action) {
      state.list = state.list.filter((candidate) => candidate.id !== action.payload);
    },
    clearCandidates(state) {
      state.list = [];
    },
  },
});

export const {
  addOrUpdateCandidate,
  updateCandidate,
  addInterviewToCandidate,
  removeCandidate,
  clearCandidates,
} = slice.actions;
export default slice.reducer;
