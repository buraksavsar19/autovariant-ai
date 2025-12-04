import App from "./App";
import { createRoot } from "react-dom/client";
import { initI18n } from "./utils/i18nUtils";
import * as Sentry from "@sentry/react";

// Sentry initialization (hata takibi için)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE || "development",
    tracesSampleRate: import.meta.env.MODE === "production" ? 0.1 : 1.0, // Production'da %10, development'ta %100
    beforeSend(event) {
      // SendBeacon hatalarını filtrele (Shopify App Bridge'den kaynaklanabilir)
      if (event.exception?.values?.[0]?.value?.includes("SendBeacon")) {
        return null; // Bu hatayı gönderme
      }
      return event;
    },
  });
  console.log("✅ Sentry initialized for frontend error tracking");
} else {
  console.log("⚠️  Sentry DSN not found, frontend error tracking disabled");
}

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
