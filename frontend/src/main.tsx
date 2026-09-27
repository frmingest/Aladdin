import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AnalystModeProvider } from "./lib/analystMode";
import { DemoModeProvider } from "./lib/demoMode";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <DemoModeProvider>
        <AnalystModeProvider>
          <App />
        </AnalystModeProvider>
      </DemoModeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
