import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Lock screen to portrait when Screen Orientation API is available (PWA, some mobile browsers)
try {
  if (typeof screen !== 'undefined' && screen.orientation?.lock) {
    screen.orientation.lock('portrait').catch(() => {});
  }
} catch {
  /* ignore */
}

createRoot(document.getElementById("root")!).render(<App />);
