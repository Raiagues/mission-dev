import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./workspace.css";
import "./polish.css";
import "./home-artwork.css";
import "./setup-memory-readability.css";

const root = document.getElementById("root");

if (!root) throw new Error("Mission Dev root element was not found.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
