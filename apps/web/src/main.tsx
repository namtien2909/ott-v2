import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { applyPresentationPreferences } from "./services/presentation/preferences";
import { applyDesignTokens } from "./foundation/tokens";
import { applyQualityTier } from "./foundation/qualityTier";
import "./styles/globals.css";

applyPresentationPreferences();
applyDesignTokens("dark");
applyQualityTier();

const root = document.getElementById("root");
if (!root) throw new Error("Không tìm thấy phần tử #root.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
