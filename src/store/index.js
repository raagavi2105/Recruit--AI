// src/store/index.js
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage"; // localStorage
import candidatesReducer from "./slices/candidatesSlice";
import interviewReducer from "./slices/interviewSlice";

const rootReducer = combineReducers({
  candidates: candidatesReducer,
  interview: interviewReducer,
});

const persistConfig = {
  key: "root",
  version: 1,
  storage,
  whitelist: ["candidates", "interview"],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export default store;
