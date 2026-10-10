import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { initArtPack } from "./lib/artPack";
import { DemoModeProvider } from "./lib/demoMode";
import { GameModeProvider } from "./lib/gameMode";
import "./index.css";

initArtPack();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <DemoModeProvider>
        <GameModeProvider>
          <App />
        </GameModeProvider>
      </DemoModeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
