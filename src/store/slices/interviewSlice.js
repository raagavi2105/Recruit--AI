// src/store/slices/interviewSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  current: null,
  sessions: {}, // sessionId => session object
};

const slice = createSlice({
  name: "interview",
  initialState,
  reducers: {
    startSession(state, action) {
      const session = action.payload;
      state.current = session;
      state.sessions = { ...state.sessions, [session.sessionId]: session };
    },
    updateCurrent(state, action) {
      if (!state.current) return;
      const updated = { ...state.current, ...action.payload };
      state.current = updated;
      state.sessions = { ...state.sessions, [updated.sessionId]: updated };
    },
    finishSession(state, action) {
      const { sessionId, finalScore, summary } = action.payload;
      const s = state.sessions[sessionId];
      if (s) {
        const finished = { ...s, status: "finished", finalScore, summary };
        state.sessions = { ...state.sessions, [sessionId]: finished };
        if (state.current?.sessionId === sessionId) state.current = null;
      }
    },
    loadSessions(state, action) {
      state.sessions = action.payload || {};
    },
    clearCurrent(state) {
      state.current = null;
    },
  },
});

export const { startSession, updateCurrent, finishSession, loadSessions, clearCurrent } =
  slice.actions;
export default slice.reducer;
