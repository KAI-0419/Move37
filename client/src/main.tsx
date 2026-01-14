import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/i18n";
import { audioManager } from "./lib/audio";

// Initialize audio manager when app starts
audioManager.initialize().catch(console.warn);

createRoot(document.getElementById("root")!).render(<App />);
