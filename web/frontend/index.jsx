import App from "./App";
import { createRoot } from "react-dom/client";
import { initI18n } from "./utils/i18nUtils";

// SendBeacon hatalarını filtrele (Vite HMR veya Shopify App Bridge'den kaynaklanabilir)
window.addEventListener("error", (event) => {
  if (event.message && event.message.includes("SendBeacon")) {
    event.preventDefault();
    return false;
  }
});

// Unhandled promise rejection'ları da yakala
window.addEventListener("unhandledrejection", (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes("SendBeacon")) {
    event.preventDefault();
    return false;
  }
});

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
