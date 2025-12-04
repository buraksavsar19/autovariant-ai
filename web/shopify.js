import { BillingInterval } from "@shopify/shopify-api";
import { shopifyApp } from "@shopify/shopify-app-express";
import { SQLiteSessionStorage } from "@shopify/shopify-app-session-storage-sqlite";
import { PostgreSQLSessionStorage } from "@shopify/shopify-app-session-storage-postgresql";
import { restResources } from "@shopify/shopify-api/rest/admin/2025-01";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ES modules'da __dirname yok, oluşturuyoruz
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path'i - web/ klasöründen çalışıyor, database.sqlite web/ klasöründe
const DB_PATH = join(__dirname, 'database.sqlite');

// Session Storage: Production'da PostgreSQL, Development'ta SQLite
let sessionStorage;

if (process.env.DATABASE_URL) {
  // Production: PostgreSQL kullan
  console.log("🗄️  Using PostgreSQL for session storage");
  sessionStorage = new PostgreSQLSessionStorage(process.env.DATABASE_URL);
} else {
  // Development: SQLite kullan
  console.log("🗄️  Using SQLite for session storage (development mode)");
  sessionStorage = new SQLiteSessionStorage(DB_PATH);
}

// Pricing plans
const billingConfig = {
  "Starter Plan": {
    amount: 4.99,
    currencyCode: "USD",
    interval: BillingInterval.OneTime,
  },
  "Basic Plan": {
    amount: 19.99,
    currencyCode: "USD",
    interval: BillingInterval.OneTime,
  },
  "Pro Plan": {
    amount: 39.99,
    currencyCode: "USD",
    interval: BillingInterval.OneTime,
  },
  "Premium Plan": {
    amount: 59.99,
    currencyCode: "USD",
    interval: BillingInterval.OneTime,
  },
  "Monthly Subscription": {
    amount: 49.99,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
  },
};

const shopify = shopifyApp({
  api: {
    apiVersion: "2025-01",
    restResources,
    future: {
      customerAddressDefaultFix: true,
      lineItemBilling: true,
      unstable_managedPricingSupport: true,
    },
    billing: billingConfig,
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
  sessionStorage: sessionStorage,
});

export default shopify;
