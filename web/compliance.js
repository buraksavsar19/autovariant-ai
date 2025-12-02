import { DeliveryMethod } from "@shopify/shopify-api";

/**
 * Mandatory compliance webhooks for Shopify App Store
 * https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks
 * 
 * @type {{[key: string]: import("@shopify/shopify-api").WebhookHandler}}
 */
export default {
  /**
   * When a merchant uninstalls your app, Shopify invokes this webhook.
   * This is a mandatory compliance webhook.
   * 
   * https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks#app-uninstalled
   */
  APP_UNINSTALLED: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks",
    callback: async (topic, shop, body, webhookId) => {
      const payload = JSON.parse(body);
      // Payload has the following shape:
      // {
      //   "id": 123456789,
      //   "name": "My App",
      //   "email": "merchant@example.com",
      //   "shop_owner": "merchant@example.com",
      //   "timezone": "UTC",
      //   "domain": "my-shop.myshopify.com",
      //   "province": null,
      //   "country": "US",
      //   "address1": null,
      //   "zip": null,
      //   "city": null,
      //   "source": null,
      //   "phone": null,
      //   "latitude": null,
      //   "longitude": null,
      //   "primary_locale": "en",
      //   "address2": null,
      //   "created_at": "2023-01-01T00:00:00-00:00",
      //   "updated_at": "2023-01-01T00:00:00-00:00",
      //   "country_code": "US",
      //   "country_name": "United States",
      //   "currency": "USD",
      //   "customer_email": "merchant@example.com",
      //   "plan_name": "basic",
      //   "plan_display_name": "Basic",
      //   "has_discounts": false,
      //   "has_gift_cards": false,
      //   "province_code": null,
      //   "myshopify_domain": "my-shop.myshopify.com",
      //   "google_apps_domain": null,
      //   "google_apps_login_enabled": null,
      //   "money_in_currency_format": "$0.00",
      //   "money_with_currency_in_currency_format": "$0.00 USD",
      //   "setup_required": false
      // }
      
      // Clean up any app-specific data for this shop
      // Example: Delete sessions, remove shop data, etc.
      console.log(`App uninstalled for shop: ${shop}`);
      console.log(`Webhook ID: ${webhookId}`);
      
      // TODO: Implement cleanup logic here
      // - Delete shop sessions from database
      // - Remove shop-specific data
      // - Cancel any active subscriptions
    },
  },

  /**
   * When a shop's information is updated, Shopify invokes this webhook.
   * This is a mandatory compliance webhook.
   * 
   * https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks#shop-update
   */
  SHOP_UPDATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks",
    callback: async (topic, shop, body, webhookId) => {
      const payload = JSON.parse(body);
      // Payload has the same shape as APP_UNINSTALLED
      
      // Update shop information in your database
      console.log(`Shop updated: ${shop}`);
      console.log(`Webhook ID: ${webhookId}`);
      
      // TODO: Implement shop update logic here
      // - Update shop information in database
      // - Sync shop settings if needed
    },
  },

  /**
   * When an app subscription is updated, Shopify invokes this webhook.
   * This is a mandatory compliance webhook.
   * 
   * https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks#app-subscription-update
   */
  APP_SUBSCRIPTION_UPDATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks",
    callback: async (topic, shop, body, webhookId) => {
      const payload = JSON.parse(body);
      // Payload has the following shape:
      // {
      //   "id": 123456789,
      //   "name": "Pro Plan",
      //   "price": "9.99",
      //   "status": "active",
      //   "return_url": "https://my-app.com/return",
      //   "test": false,
      //   "trial_days": 0,
      //   "trial_ends_on": null,
      //   "created_at": "2023-01-01T00:00:00-00:00",
      //   "updated_at": "2023-01-01T00:00:00-00:00",
      //   "cancelled_at": null,
      //   "currency": "USD",
      //   "billing_on": "2023-02-01",
      //   "activated_on": "2023-01-01",
      //   "app_id": 123456,
      //   "app_name": "My App"
      // }
      
      // Update subscription information in your database
      console.log(`App subscription updated for shop: ${shop}`);
      console.log(`Webhook ID: ${webhookId}`);
      
      // TODO: Implement subscription update logic here
      // - Update subscription status in database
      // - Sync subscription features
      // - Handle subscription cancellations
    },
  },
};


