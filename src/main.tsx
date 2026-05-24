import { createRoot } from "react-dom/client";
import { runDevelopmentResetIfNeeded } from "./utils/devReset";
import { configureNativeChrome } from "./utils/nativeChrome";
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

async function bootstrap() {
  const didReset = await runDevelopmentResetIfNeeded();
  if (didReset) {
    console.log('[DEV RESET] Cold start complete — showing login');
  }
  await configureNativeChrome();
  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
