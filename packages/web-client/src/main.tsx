import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const RootElement = document.getElementById("root");
if (!RootElement) {
  throw new Error("Missing #root element");
}

createRoot(RootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
