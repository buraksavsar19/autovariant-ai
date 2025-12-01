import App from "./App";
import { createRoot } from "react-dom/client";
import { initI18n } from "./utils/i18nUtils";

// SendBeacon hatalarını filtrele (Vite HMR veya Shopify App Bridge'den kaynaklanabilir)
window.addEventListener("error", (event) => {
  const errorMessage = event.message || event.error?.message || "";
  if (errorMessage.includes("SendBeacon")) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}, true); // capture phase'de yakala

// Unhandled promise rejection'ları da yakala
window.addEventListener("unhandledrejection", (event) => {
  const errorMessage = event.reason?.message || String(event.reason || "");
  if (errorMessage.includes("SendBeacon")) {
    event.preventDefault();
    return false;
  }
});

// Console.error'u override et (SendBeacon hatalarını gizle)
const originalConsoleError = console.error;
console.error = function(...args) {
  const message = args.join(" ");
  if (message.includes("SendBeacon")) {
    return; // SendBeacon hatalarını gizle
  }
  originalConsoleError.apply(console, args);
};

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
