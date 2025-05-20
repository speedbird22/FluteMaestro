import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add global CSS for the audio visualization and swar display
const style = document.createElement('style');
style.textContent = `
  .audio-level {
    transition: height 0.1s ease;
  }
  .swar-display {
    transition: all 0.3s ease;
  }
  .swar-note {
    transition: transform 0.2s ease, opacity 0.2s ease;
  }
  .swar-note.active {
    transform: scale(1.1);
    opacity: 1;
  }
  .swar-note.inactive {
    transform: scale(0.95);
    opacity: 0.5;
  }
  .audio-visualizer {
    height: 60px;
  }
  .audio-level-bar {
    width: 8px;
    margin: 0 1px;
    border-radius: 2px;
    transform-origin: bottom;
    transition: height 0.1s ease-out;
  }
`;
document.head.appendChild(style);

createRoot(document.getElementById("root")!).render(<App />);
