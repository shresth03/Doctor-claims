import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import "./index.css";
import App from "./App.tsx";
import { API_MODE, mockControls } from "./api";
import { useAppStore } from "./lib/store";

// Demo-only switches for exercising failure paths (409 lock, EDI rejection). Never present against a live backend.
if (import.meta.env.DEV && API_MODE === "mock") {
  (window as unknown as { __claimsDemo: typeof mockControls }).__claimsDemo = mockControls;
  (window as unknown as { __store: typeof useAppStore }).__store = useAppStore;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Respect the OS reduced-motion setting for every framer-motion animation */}
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
);
