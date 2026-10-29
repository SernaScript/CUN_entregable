import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SimulatorPage } from "./pages/SimulatorPage";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SimulatorPage />
  </StrictMode>,
);
