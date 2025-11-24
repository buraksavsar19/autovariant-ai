import App from "./App";
import { createRoot } from "react-dom/client";
import { initI18n } from "./utils/i18nUtils";

console.log("index.jsx loaded, initializing app...");

// Ensure that locales are loaded before rendering the app
initI18n()
  .then(() => {
    console.log("i18n initialized successfully");
    const appElement = document.getElementById("app");
    if (!appElement) {
      console.error("App element not found!");
      return;
    }
    const root = createRoot(appElement);
    root.render(<App />);
    console.log("App rendered successfully");
  })
  .catch((error) => {
    console.error("i18n initialization error:", error);
    // Hata olsa bile uygulamayı render et
    const appElement = document.getElementById("app");
    if (!appElement) {
      console.error("App element not found!");
      return;
    }
    const root = createRoot(appElement);
  root.render(<App />);
    console.log("App rendered with error fallback");
});
