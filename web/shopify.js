import { BillingInterval, LATEST_API_VERSION } from "@shopify/shopify-api";
import { shopifyApp } from "@shopify/shopify-app-express";
import { SQLiteSessionStorage } from "@shopify/shopify-app-session-storage-sqlite";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-10";

const DB_PATH = `${process.cwd()}/database.sqlite`;

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
    apiVersion: LATEST_API_VERSION,
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
  // This should be replaced with your preferred storage strategy
  sessionStorage: new SQLiteSessionStorage(DB_PATH),
});

export default shopify;
