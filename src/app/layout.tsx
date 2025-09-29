// src/app/layout.tsx
"use client";

import React from "react";
import { Provider } from "react-redux";
import store, { persistor } from "../store";
import { PersistGate } from "redux-persist/integration/react";
import "../styles/globals.css";
import "antd/dist/reset.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <div className="app-shell">{children}</div>
          </PersistGate>
        </Provider>
      </body>
    </html>
  );
}
