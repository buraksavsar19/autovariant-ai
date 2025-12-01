// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";
import multer from "multer";

// Environment variables yükle
import dotenv from "dotenv";
dotenv.config();

// Node.js 18+ için fetch global, eski versiyonlar için node-fetch gerekebilir
// FormData için global FormData kullanacağız (Node.js 18+)

import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";
import ComplianceWebhookHandlers from "./compliance.js";
import { parseVariantPrompt, parseVariantPromptWithGPT, createVariants } from "./variant-creator.js";
import OpenAI from "openai";
import sharp from "sharp";

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Demo Mode kontrolü
const DEMO_MODE = process.env.DEMO_MODE === "true" || process.env.DEMO_MODE === "1";

// Mock data for demo mode
const MOCK_PRODUCTS = [
  { id: "gid://shopify/Product/1", title: "Demo T-Shirt", handle: "demo-t-shirt", variantsCount: 1, options: [{ name: "Size", values: ["S", "M", "L"] }, { name: "Color", values: ["Red", "Blue"] }], hasExistingVariants: false },
  { id: "gid://shopify/Product/2", title: "Demo Hoodie", handle: "demo-hoodie", variantsCount: 3, options: [{ name: "Size", values: ["M", "L", "XL"] }, { name: "Color", values: ["Black", "White", "Gray"] }], hasExistingVariants: true },
  { id: "gid://shopify/Product/3", title: "Demo Jeans", handle: "demo-jeans", variantsCount: 0, options: [{ name: "Size", values: ["28", "30", "32", "34"] }, { name: "Color", values: ["Blue", "Black"] }], hasExistingVariants: false },
];

// Demo mode middleware - authentication'ı bypass et
const demoModeMiddleware = (req, res, next) => {
  if (DEMO_MODE) {
    // Mock session oluştur
    res.locals.shopify = {
      session: {
        shop: "demo-store.myshopify.com",
        accessToken: "demo-token",
        id: "demo-session-id",
      },
    };
  }
  next();
};

// Privacy Policy ve Terms of Service route'ları (public, authentication gerektirmez)
// Bu route'lar authentication middleware'den ÖNCE olmalı
app.get("/privacy", (_req, res) => {
  try {
    // Railway'de working directory /app, dosyalar web/ klasöründe
    const possiblePaths = [
      join(process.cwd(), "PRIVACY.md"),  // web/PRIVACY.md (Railway'de /app/PRIVACY.md)
      join(process.cwd(), "..", "PRIVACY.md"),  // Root'taki dosya (fallback)
    ];
    
    let privacyContent = null;
    let usedPath = null;
    
    for (const path of possiblePaths) {
      try {
        privacyContent = readFileSync(path, "utf-8");
        usedPath = path;
        break;
      } catch (e) {
        // Bu path çalışmadı, bir sonrakini dene
        continue;
      }
    }
    
    if (!privacyContent) {
      throw new Error(`PRIVACY.md dosyası bulunamadı. Denenen path'ler: ${possiblePaths.join(", ")}`);
    }
    
    // Markdown'ı HTML'e çevir
    const lines = privacyContent.split('\n');
    let htmlParts = [];
    let inList = false;
    let inParagraph = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed.startsWith('# ')) {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        if (inParagraph) {
          htmlParts.push('</p>');
          inParagraph = false;
        }
        htmlParts.push(`<h1>${trimmed.substring(2)}</h1>`);
      } else if (trimmed.startsWith('## ')) {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        if (inParagraph) {
          htmlParts.push('</p>');
          inParagraph = false;
        }
        htmlParts.push(`<h2>${trimmed.substring(3)}</h2>`);
      } else if (trimmed.startsWith('### ')) {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        if (inParagraph) {
          htmlParts.push('</p>');
          inParagraph = false;
        }
        htmlParts.push(`<h3>${trimmed.substring(4)}</h3>`);
      } else if (trimmed.startsWith('- ')) {
        if (inParagraph) {
          htmlParts.push('</p>');
          inParagraph = false;
        }
        if (!inList) {
          htmlParts.push('<ul>');
          inList = true;
        }
        // Bold text'i replace et
        let listItem = trimmed.substring(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        htmlParts.push(`<li>${listItem}</li>`);
      } else if (trimmed === '' || trimmed === '---') {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        if (inParagraph) {
          htmlParts.push('</p>');
          inParagraph = false;
        }
        if (trimmed === '---') {
          htmlParts.push('<hr>');
        }
      } else {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        // Bold text'i replace et
        let processedLine = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        if (!inParagraph) {
          htmlParts.push('<p>');
          inParagraph = true;
        } else {
          htmlParts.push(' ');
        }
        htmlParts.push(processedLine);
      }
    }
    
    if (inList) {
      htmlParts.push('</ul>');
    }
    if (inParagraph) {
      htmlParts.push('</p>');
    }
    
    res.status(200)
      .set("Content-Type", "text/html")
      .send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Privacy Policy - Autovariant AI</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.8;
              max-width: 900px;
              margin: 0 auto;
              padding: 40px 20px;
              color: #2c3e50;
              background-color: #f8f9fa;
            }
            h1 {
              color: #2c3e50;
              border-bottom: 3px solid #3498db;
              padding-bottom: 15px;
              margin-bottom: 30px;
              font-size: 2.5em;
              font-weight: 700;
            }
            h2 {
              color: #34495e;
              margin-top: 40px;
              margin-bottom: 20px;
              font-size: 1.8em;
              font-weight: 600;
              padding-top: 10px;
            }
            h3 {
              color: #34495e;
              margin-top: 30px;
              margin-bottom: 15px;
              font-size: 1.4em;
              font-weight: 600;
            }
            p {
              margin: 15px 0;
              text-align: justify;
              font-size: 1.05em;
            }
            ul {
              margin: 20px 0;
              padding-left: 30px;
              list-style-type: disc;
            }
            li {
              margin: 10px 0;
              line-height: 1.8;
              font-size: 1.05em;
            }
            strong {
              font-weight: 600;
              color: #2c3e50;
            }
            hr {
              margin: 30px 0;
              border: none;
              border-top: 1px solid #e0e0e0;
            }
          </style>
        </head>
        <body>
          ${htmlParts.join('\n')}
        </body>
        </html>
      `);
  } catch (error) {
    console.error("Privacy Policy okuma hatası:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Error - Privacy Policy</title>
      </head>
      <body>
        <h1>Privacy Policy yüklenemedi</h1>
        <p>Hata: ${error.message}</p>
        <p>Stack: ${error.stack}</p>
      </body>
      </html>
    `);
  }
});

app.get("/terms", (_req, res) => {
  try {
    // Railway'de working directory /app, dosyalar web/ klasöründe
    const possiblePaths = [
      join(process.cwd(), "TERMS.md"),  // web/TERMS.md (Railway'de /app/TERMS.md)
      join(process.cwd(), "..", "TERMS.md"),  // Root'taki dosya (fallback)
    ];
    
    let termsContent = null;
    let usedPath = null;
    
    for (const path of possiblePaths) {
      try {
        termsContent = readFileSync(path, "utf-8");
        usedPath = path;
        break;
      } catch (e) {
        // Bu path çalışmadı, bir sonrakini dene
        continue;
      }
    }
    
    if (!termsContent) {
      throw new Error(`TERMS.md dosyası bulunamadı. Denenen path'ler: ${possiblePaths.join(", ")}`);
    }
    
    // Markdown'ı HTML'e çevir
    const lines = termsContent.split('\n');
    let htmlParts = [];
    let inList = false;
    let inParagraph = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed.startsWith('# ')) {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        if (inParagraph) {
          htmlParts.push('</p>');
          inParagraph = false;
        }
        htmlParts.push(`<h1>${trimmed.substring(2)}</h1>`);
      } else if (trimmed.startsWith('## ')) {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        if (inParagraph) {
          htmlParts.push('</p>');
          inParagraph = false;
        }
        htmlParts.push(`<h2>${trimmed.substring(3)}</h2>`);
      } else if (trimmed.startsWith('### ')) {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        if (inParagraph) {
          htmlParts.push('</p>');
          inParagraph = false;
        }
        htmlParts.push(`<h3>${trimmed.substring(4)}</h3>`);
      } else if (trimmed.startsWith('- ')) {
        if (inParagraph) {
          htmlParts.push('</p>');
          inParagraph = false;
        }
        if (!inList) {
          htmlParts.push('<ul>');
          inList = true;
        }
        // Bold text'i replace et
        let listItem = trimmed.substring(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        htmlParts.push(`<li>${listItem}</li>`);
      } else if (trimmed === '' || trimmed === '---') {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        if (inParagraph) {
          htmlParts.push('</p>');
          inParagraph = false;
        }
        if (trimmed === '---') {
          htmlParts.push('<hr>');
        }
      } else {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        // Bold text'i replace et
        let processedLine = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        if (!inParagraph) {
          htmlParts.push('<p>');
          inParagraph = true;
        } else {
          htmlParts.push(' ');
        }
        htmlParts.push(processedLine);
      }
    }
    
    if (inList) {
      htmlParts.push('</ul>');
    }
    if (inParagraph) {
      htmlParts.push('</p>');
    }
    
    res.status(200)
      .set("Content-Type", "text/html")
      .send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Terms of Service - Autovariant AI</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.8;
              max-width: 900px;
              margin: 0 auto;
              padding: 40px 20px;
              color: #2c3e50;
              background-color: #f8f9fa;
            }
            h1 {
              color: #2c3e50;
              border-bottom: 3px solid #3498db;
              padding-bottom: 15px;
              margin-bottom: 30px;
              font-size: 2.5em;
              font-weight: 700;
            }
            h2 {
              color: #34495e;
              margin-top: 40px;
              margin-bottom: 20px;
              font-size: 1.8em;
              font-weight: 600;
              padding-top: 10px;
            }
            h3 {
              color: #34495e;
              margin-top: 30px;
              margin-bottom: 15px;
              font-size: 1.4em;
              font-weight: 600;
            }
            p {
              margin: 15px 0;
              text-align: justify;
              font-size: 1.05em;
            }
            ul {
              margin: 20px 0;
              padding-left: 30px;
              list-style-type: disc;
            }
            li {
              margin: 10px 0;
              line-height: 1.8;
              font-size: 1.05em;
            }
            strong {
              font-weight: 600;
              color: #2c3e50;
            }
            hr {
              margin: 30px 0;
              border: none;
              border-top: 1px solid #e0e0e0;
            }
          </style>
        </head>
        <body>
          ${htmlParts.join('\n')}
        </body>
        </html>
      `);
  } catch (error) {
    console.error("Terms of Service okuma hatası:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Error - Terms of Service</title>
      </head>
      <body>
        <h1>Terms of Service yüklenemedi</h1>
        <p>Hata: ${error.message}</p>
        <p>Stack: ${error.stack}</p>
      </body>
      </html>
    `);
  }
});

// Demo mode route'ları (authentication'dan önce)
if (DEMO_MODE) {
  console.log("🚀 DEMO MODE ENABLED - Mock data ile çalışıyor");
  
  // Demo mode için mock API endpoint'leri
  app.get("/api/demo/products/list", demoModeMiddleware, async (_req, res) => {
    res.status(200).send({ products: MOCK_PRODUCTS });
  });

  app.get("/api/demo/products/count", demoModeMiddleware, async (_req, res) => {
    res.status(200).send({ count: MOCK_PRODUCTS.length });
  });

  app.post("/api/demo/variants/parse", demoModeMiddleware, async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).send({ success: false, error: "Prompt gereklidir" });
      }

      // GPT ile parse et (gerçek API kullanılabilir)
      let parsedVariant;
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (apiKey) {
        try {
          parsedVariant = await parseVariantPromptWithGPT(prompt, apiKey);
        } catch (error) {
          console.warn("GPT API hatası, fallback kullanılıyor:", error.message);
          parsedVariant = parseVariantPrompt(prompt);
        }
      } else {
        parsedVariant = parseVariantPrompt(prompt);
      }

      res.status(200).send({ success: true, parsed: parsedVariant });
    } catch (error) {
      res.status(500).send({ success: false, error: error.message });
    }
  });

  app.post("/api/demo/variants/create", demoModeMiddleware, async (req, res) => {
    // Demo mode'da gerçek varyant oluşturma yapılmaz, sadece mock response döner
    const { editableVariants } = req.body;
    const variantCount = editableVariants ? editableVariants.length : 6;
    
    // Simüle edilmiş gecikme
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    res.status(200).send({
      success: true,
      variantsCreated: variantCount,
      variants: editableVariants || [],
      parsed: { sizes: ["S", "M", "L"], colors: ["Kırmızı", "Mavi"] },
      demo: true,
      message: "Demo mode: Varyantlar simüle edildi (gerçek Shopify'a kaydedilmedi)"
    });
  });

  app.post("/api/demo/images/analyze-colors", demoModeMiddleware, upload.array("images", 20), async (req, res) => {
    // Demo mode'da mock renk analizi
    const colors = JSON.parse(req.body.colors || "[]");
    const imageIds = req.body.imageIds ? 
      (Array.isArray(req.body.imageIds) ? req.body.imageIds : [req.body.imageIds]) : 
      [];
    
    const matches = req.files?.map((file, index) => {
      // Rastgele bir renk eşleştir (demo için)
      const randomColor = colors[Math.floor(Math.random() * colors.length)] || colors[0];
      return {
        imageId: imageIds[index] || `image-${index}`,
        color: randomColor
      };
    }) || [];

    await new Promise(resolve => setTimeout(resolve, 500));
    
    res.status(200).send({
      success: true,
      matches,
      demo: true,
      message: "Demo mode: Renk analizi simüle edildi"
    });
  });

  app.post("/api/demo/images/upload-to-shopify", demoModeMiddleware, upload.array("images", 20), async (req, res) => {
    // Demo mode'da mock upload
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    res.status(200).send({
      success: true,
      uploaded: req.files?.length || 0,
      demo: true,
      message: "Demo mode: Görseller simüle edildi (gerçek Shopify'a yüklenmedi)"
    });
  });
}

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
// Combine privacy and compliance webhook handlers
const allWebhookHandlers = {
  ...PrivacyWebhookHandlers,
  ...ComplianceWebhookHandlers,
};

app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: allWebhookHandlers })
);

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js

// ============================================================================
// TEST ENDPOINT - Backend'in çalışıp çalışmadığını test et
// ============================================================================
app.get("/api/test", (req, res) => {
  console.log("✅✅✅ TEST ENDPOINT HIT ✅✅✅");
  res.status(200).json({ message: "Backend is working!", timestamp: new Date().toISOString() });
});

// ============================================================================
// CRITICAL: /api/products/list endpoint - EN BAŞTA (test endpoint'inden sonra)
// ============================================================================
// Bu endpoint'i EN BAŞTA tanımla ki hiçbir middleware intercept etmesin

// ============================================================================
// CRITICAL: /api/products/list endpoint - EN BAŞTA (express.json'dan ÖNCE)
// ============================================================================
// Bu endpoint'i EN BAŞTA tanımla ki hiçbir middleware intercept etmesin
app.get("/api/products/list", async (req, res) => {
  // HEMEN log - request geldiğini görmek için
  console.log("✅✅✅ /api/products/list endpoint HIT - Request received ✅✅✅");
  
  // Hemen response headers set et
  res.setHeader('Content-Type', 'application/json');
  
  // CRITICAL: HEMEN boş array döndür - backend'in çalıştığını test et
  // Eğer bu bile gelmiyorsa, sorun Railway routing'de
  try {
    // Shop bilgisini query'den, header'dan veya cookie'den al
    let shop = req.query.shop || req.headers['x-shopify-shop-domain'];
    
    if (!shop && req.headers.referer) {
      try {
        const refererUrl = new URL(req.headers.referer);
        shop = refererUrl.searchParams.get('shop');
      } catch (e) {}
    }
    
    if (!shop && req.headers.cookie) {
      try {
        const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {});
        shop = cookies['shopify_app_session'] || cookies['shop'];
      } catch (e) {}
    }
    
    if (!shop) {
      console.error("❌ Shop bilgisi bulunamadı");
      return res.status(200).json({ 
        products: [],
        error: "Shop information not found - please reinstall the app"
      });
    }
    
    console.log("🔍 Shop found:", shop);
    
    // Session'ı database'den yükle
    try {
      const sessionId = `shopify_app_session_${shop}`;
      const session = await shopify.config.sessionStorage.loadSession(sessionId);
      
      if (!session) {
        console.error("❌ Session database'de bulunamadı");
        return res.status(200).json({ 
          products: [],
          error: "Session not found - please reinstall the app"
        });
      }
      
      res.locals.shopify = { session };
      console.log("✅ Session loaded:", session.shop);
      
      // Session var, devam et
      await handleProductsList(req, res, Date.now());
    } catch (sessionError) {
      console.error("❌ Session load error:", sessionError.message);
      return res.status(200).json({ 
        products: [],
        error: "Session error - please reinstall the app"
      });
    }
  } catch (error) {
    console.error(`❌ Error in /api/products/list:`, error.message);
    return res.status(200).json({ 
      products: [],
      error: error.message || "Ürünler yüklenirken bir hata oluştu"
    });
  }
});

app.use(express.json());

// ============================================================================
// SCENARIO 1: CORS Headers - Tüm API endpoint'leri için
// ============================================================================
app.use("/api/*", (req, res, next) => {
  // CORS headers - Tüm origin'lere izin ver (production'da güvenlik için kısıtlanabilir)
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 saat
  
  // Preflight request'i handle et - HEMEN response döndür
  if (req.method === 'OPTIONS') {
    console.log("✅ CORS preflight request handled");
    return res.status(200).end();
  }
  
  next();
});

// Endpoint yukarıda tanımlandı (satır 605'te)

// Demo mode'da authentication'ı bypass et
if (DEMO_MODE) {
  app.use("/api/demo/*", demoModeMiddleware);
} else {
  // Diğer API endpoint'leri için validateAuthenticatedSession kullan
  app.use("/api/*", shopify.validateAuthenticatedSession());
}

// Billing endpoints
app.get("/api/billing/status", async (_req, res) => {
  try {
    const session = res.locals.shopify.session;
    const billing = await shopify.api.billing.check({
      session,
      plans: Object.keys(shopify.config.billing),
      isTest: process.env.NODE_ENV !== "production",
    });

    res.status(200).send({
      hasActivePayment: billing.hasActivePayment,
      confirmationUrl: billing.confirmationUrl,
    });
  } catch (error) {
    console.error("Billing status kontrolü hatası:", error);
    res.status(500).send({
      error: error.message || "Billing durumu kontrol edilemedi",
    });
  }
});

app.post("/api/billing/request", async (req, res) => {
  try {
    const { planName } = req.body;

    if (!planName || !shopify.config.billing[planName]) {
      return res.status(400).send({
        error: "Geçersiz plan adı",
      });
    }

    const session = res.locals.shopify.session;
    const billing = await shopify.api.billing.request({
      session,
      plan: planName,
      isTest: process.env.NODE_ENV !== "production",
    });

    res.status(200).send({
      confirmationUrl: billing.confirmationUrl,
    });
  } catch (error) {
    console.error("Billing isteği hatası:", error);
    res.status(500).send({
      error: error.message || "Billing isteği gönderilemedi",
    });
  }
});

// Multer setup for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

app.get("/api/products/count", async (_req, res) => {
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  const countData = await client.request(`
    query shopifyProductCount {
      productsCount {
        count
      }
    }
  `);

  res.status(200).send({ count: countData.data.productsCount.count });
});

// Template ürünlerini tespit etmek için kullanılan kelimeler
const TEMPLATE_ADJECTIVES = [
  "autumn", "hidden", "bitter", "misty", "silent", "empty", "dry", "dark",
  "summer", "icy", "delicate", "quiet", "white", "cool", "spring", "winter",
  "patient", "twilight", "dawn", "crimson", "wispy", "weathered", "blue",
  "billowing", "broken", "cold", "damp", "falling", "frosty", "green", "long"
];

const TEMPLATE_NOUNS = [
  "waterfall", "river", "breeze", "moon", "rain", "wind", "sea", "morning",
  "snow", "lake", "sunset", "pine", "shadow", "leaf", "dawn", "glitter",
  "forest", "hill", "cloud", "meadow", "sun", "glade", "bird", "brook",
  "butterfly", "bush", "dew", "dust", "field", "fire", "flower"
];

// Template ürünü mü kontrol et
function isTemplateProduct(title) {
  const lowerTitle = title.toLowerCase().trim();
  const words = lowerTitle.split(/\s+/);
  
  // Eğer 2 kelimeden fazla veya azsa, template ürünü değil
  if (words.length !== 2) {
    return false;
  }
  
  const [firstWord, secondWord] = words;
  
  // İlk kelime adjective, ikinci kelime noun mu kontrol et
  return (
    TEMPLATE_ADJECTIVES.includes(firstWord) &&
    TEMPLATE_NOUNS.includes(secondWord)
  );
}

// Endpoint yukarıda tanımlandı, burada sadece handleProductsList fonksiyonu var

// ============================================================================
// SCENARIO 3: Products list logic - GraphQL timeout ve error handling
// ============================================================================
async function handleProductsList(req, res, startTime) {
  // Session kontrolü - detaylı log
  console.log("🔍 handleProductsList - Session check:", {
    hasShopify: !!res.locals.shopify,
    hasSession: !!(res.locals.shopify && res.locals.shopify.session),
    shop: res.locals.shopify?.session?.shop,
    sessionId: res.locals.shopify?.session?.id
  });
  
  if (!res.locals.shopify || !res.locals.shopify.session) {
    throw new Error("Session bulunamadı in handleProductsList");
  }

  const shop = res.locals.shopify.session.shop;
  console.log(`📦 Fetching products for shop: ${shop}`);

  try {
    const client = new shopify.api.clients.Graphql({
      session: res.locals.shopify.session,
    });

    // SCENARIO 4: GraphQL timeout - 8 saniye (daha uzun timeout)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.warn("⏱️ GraphQL request timeout after 8s");
        reject(new Error("GraphQL request timeout after 8s"));
      }, 8000);
    });

    // SCENARIO 5: GraphQL query - Optimize edilmiş, error handling ile
    console.log("🔍 Starting GraphQL query...");
    const graphqlStartTime = Date.now();
    
    const productsData = await Promise.race([
      client.request(`
        query getProducts {
          products(first: 50, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                title
                handle
                variantsCount {
                  count
                }
                options {
                  name
                  values
                }
              }
            }
          }
        }
      `).catch((graphqlError) => {
        console.error("❌ GraphQL request error:", {
          message: graphqlError.message,
          name: graphqlError.name,
          stack: graphqlError.stack?.substring(0, 500)
        });
        throw graphqlError;
      }),
      timeoutPromise
    ]);
    
    const graphqlDuration = Date.now() - graphqlStartTime;
    console.log(`✅ GraphQL query completed in ${graphqlDuration}ms`);

    // GraphQL response'unu güvenli bir şekilde parse et
    console.log("🔍 GraphQL Response structure:", {
      hasData: !!productsData.data,
      hasProducts: !!(productsData.data && productsData.data.products),
      hasEdges: !!(productsData.data && productsData.data.products && productsData.data.products.edges),
      edgesLength: productsData.data?.products?.edges?.length || 0,
      fullResponse: JSON.stringify(productsData).substring(0, 500)
    });

    // Response formatını kontrol et
    if (!productsData || !productsData.data) {
      throw new Error("GraphQL response has no data field");
    }

    if (!productsData.data.products) {
      throw new Error("GraphQL response has no products field");
    }

    if (!productsData.data.products.edges) {
      console.warn("⚠️ No edges in products response, returning empty array");
      return res.status(200).send({ products: [] });
    }

    // Tüm ürünleri al (template filtreleme kaldırıldı - kullanıcı kendi ürünlerini görmeli)
    const allProducts = productsData.data.products.edges
      .map((edge) => {
        if (!edge || !edge.node) {
          console.warn("⚠️ Invalid edge structure:", edge);
          return null;
        }
        const product = edge.node;
        return {
          id: product.id,
          title: product.title,
          handle: product.handle,
          variantsCount: product.variantsCount?.count || 0,
          options: product.options || [],
          hasExistingVariants: (product.variantsCount?.count || 0) > 1,
        };
      })
      .filter(Boolean); // null'ları filtrele

    const duration = Date.now() - startTime;
    console.log(`✅ Products loaded in ${duration}ms, total: ${allProducts.length}`);
    if (allProducts.length > 0) {
      console.log(`📋 First 3 products:`, allProducts.slice(0, 3).map(p => ({ id: p.id, title: p.title })));
    } else {
      console.warn(`⚠️ No products found for shop: ${res.locals.shopify.session.shop}`);
    }

    // CORS headers ekle (gerekirse)
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send({ products: allProducts });
  } catch (error) {
    // GraphQL veya parsing hatası
    const duration = Date.now() - startTime;
    const shop = res.locals.shopify?.session?.shop || 'Unknown';
    console.error(`❌ [${shop}] handleProductsList error (${duration}ms):`, error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      name: error.name
    });
    
    // Hata durumunda detaylı bilgi döndür
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send({ 
      products: [],
      error: error.message || "Ürünler yüklenirken bir hata oluştu",
      errorType: error.name || "UnknownError"
    });
  }
}

app.post("/api/products", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    await productCreator(res.locals.shopify.session);
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }
  res.status(status).send({ success: status === 200, error });
});

// Varyant oluşturma endpoint'i
app.post("/api/variants/create", async (req, res) => {
  try {
    const { productId, prompt, editableVariants, basePrice } = req.body;

    if (!productId) {
      return res.status(400).send({
        success: false,
        error: "Ürün ID gereklidir",
      });
    }

    let parsedVariant;

    // Eğer düzenlenmiş varyantlar varsa, onları kullan
    if (editableVariants && Array.isArray(editableVariants) && editableVariants.length > 0) {
      // Editable variants'dan parsedVariant formatına çevir
      const sizes = [...new Set(editableVariants.map(v => v.size))];
      const colors = [...new Set(editableVariants.map(v => v.color))];
      
      parsedVariant = {
        sizes,
        colors,
        priceRules: [], // Editable variants'ta fiyatlar zaten hesaplanmış
        basePrice: basePrice || null,
        stockRules: [],
        defaultStock: null,
        editableVariants: editableVariants, // Düzenlenmiş varyantları da gönder
      };
    } else if (prompt) {
      // Eski yöntem: Prompt'tan parse et
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (apiKey) {
        try {
          parsedVariant = await parseVariantPromptWithGPT(prompt, apiKey);
        } catch (error) {
          console.warn("GPT API hatası, fallback kullanılıyor:", error.message);
          parsedVariant = parseVariantPrompt(prompt);
        }
      } else {
        console.warn("OPENAI_API_KEY bulunamadı, eski parser kullanılıyor");
        parsedVariant = parseVariantPrompt(prompt);
      }

      // Eğer beden bulunamadıysa hata döndür (beden zorunlu)
      if (parsedVariant.sizes.length === 0) {
        return res.status(400).send({
          success: false,
          error: "Prompt'tan beden bilgisi çıkarılamadı. Örnek: 'S'den 3XL'e kadar tüm bedenler, kırmızı yeşil mavi renkler'",
          parsed: parsedVariant,
        });
      }

      // Eğer renk bulunamadıysa hata döndür (renk zorunlu)
      if (parsedVariant.colors.length === 0) {
        return res.status(400).send({
          success: false,
          error: "Prompt'tan renk bilgisi çıkarılamadı. Lütfen renkleri belirtin. Örnek: 'kırmızı mavi sarı yeşil renklerinde'",
          parsed: parsedVariant,
        });
      }

      // "Standart" renkleri filtrele
      parsedVariant.colors = parsedVariant.colors.filter(
        color => !color.toLowerCase().includes('standart') && 
                 !color.toLowerCase().includes('default') &&
                 !color.toLowerCase().includes('varsayılan')
      );

      // Filtreleme sonrası renk kaldıysa kontrol et
      if (parsedVariant.colors.length === 0) {
        return res.status(400).send({
          success: false,
          error: "Geçerli renk bilgisi bulunamadı. Lütfen renkleri açıkça belirtin. Örnek: 'kırmızı mavi sarı yeşil'",
          parsed: parsedVariant,
        });
      }
    } else {
      return res.status(400).send({
        success: false,
        error: "Prompt veya düzenlenmiş varyantlar gereklidir",
      });
    }

    // Varyantları oluştur
    const result = await createVariants(
      res.locals.shopify.session,
      productId,
      parsedVariant
    );

    res.status(200).send({
      success: true,
      variantsCreated: result.variantsCreated,
      variants: result.variants,
      parsed: parsedVariant,
    });
  } catch (error) {
    console.error("Varyant oluşturma hatası:", error);
    
    // Daha anlaşılır hata mesajları
    let errorMessage = error.message || "Varyantlar oluşturulurken bir hata oluştu";
    let statusCode = 500;
    
    // GraphQL hataları
    if (error.message && error.message.includes("GraphqlQueryError")) {
      if (error.message.includes("Option does not exist")) {
        errorMessage = "Seçilen ürün için gerekli option'lar (Beden/Renk) bulunamadı. Lütfen ürünü kontrol edin veya önce manuel olarak option'ları ekleyin.";
      } else if (error.message.includes("limit") || error.message.includes("maximum")) {
        errorMessage = "Shopify limiti aşıldı. Ürün başına maksimum 100 varyant olabilir veya aynı anda çok fazla varyant oluşturulamaz.";
      } else if (error.message.includes("inventory")) {
        errorMessage = "Stok bilgisi eklenirken bir hata oluştu. Lütfen mağaza lokasyonlarınızı kontrol edin.";
      } else {
        errorMessage = `Shopify API hatası: ${error.message}. Lütfen ürün ve varyant bilgilerinizi kontrol edin.`;
      }
      statusCode = 400;
    }
    
    // Rate limiting hatası
    if (error.message && (error.message.includes("rate limit") || error.message.includes("429"))) {
      errorMessage = "Shopify API rate limit aşıldı. Lütfen birkaç saniye bekleyip tekrar deneyin.";
      statusCode = 429;
    }
    
    // Validasyon hataları
    if (error.message && (error.message.includes("required") || error.message.includes("gereklidir"))) {
      statusCode = 400;
    }
    
    res.status(statusCode).send({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Prompt'u parse etme endpoint'i (önizleme için)
app.post("/api/variants/parse", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).send({
        success: false,
        error: "Prompt gereklidir",
      });
    }

    // Prompt'u GPT ile parse et (fallback: eski yöntem)
    let parsedVariant;
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (apiKey) {
      try {
        parsedVariant = await parseVariantPromptWithGPT(prompt, apiKey);
        // "Standart" renkleri filtrele - eğer AI yanlışlıkla eklediyse temizle
        if (parsedVariant.colors && Array.isArray(parsedVariant.colors)) {
          parsedVariant.colors = parsedVariant.colors.filter(
            color => !color.toLowerCase().includes('standart') && 
                     !color.toLowerCase().includes('default') &&
                     !color.toLowerCase().includes('varsayılan')
          );
        }
      } catch (error) {
        console.warn("GPT API hatası, fallback kullanılıyor:", error.message);
        parsedVariant = parseVariantPrompt(prompt);
        // Fallback parser için de aynı filtreyi uygula
        if (parsedVariant.colors && Array.isArray(parsedVariant.colors)) {
          parsedVariant.colors = parsedVariant.colors.filter(
            color => !color.toLowerCase().includes('standart') && 
                     !color.toLowerCase().includes('default') &&
                     !color.toLowerCase().includes('varsayılan')
          );
        }
      }
    } else {
      parsedVariant = parseVariantPrompt(prompt);
      // Eski parser için de aynı filtreyi uygula
      if (parsedVariant.colors && Array.isArray(parsedVariant.colors)) {
        parsedVariant.colors = parsedVariant.colors.filter(
          color => !color.toLowerCase().includes('standart') && 
                   !color.toLowerCase().includes('default') &&
                   !color.toLowerCase().includes('varsayılan')
        );
      }
    }
    
    res.status(200).send({
      success: true,
      parsed: parsedVariant,
    });
  } catch (error) {
    console.error("Prompt parse hatası:", error);
    
    // Daha anlaşılır hata mesajları
    let errorMessage = error.message || "Prompt parse edilirken bir hata oluştu";
    
    // GPT API hataları
    if (error.message && error.message.includes("API key")) {
      errorMessage = "OpenAI API anahtarı bulunamadı veya geçersiz. Lütfen .env dosyanızı kontrol edin.";
    } else if (error.message && (error.message.includes("rate limit") || error.message.includes("429"))) {
      errorMessage = "OpenAI API rate limit aşıldı. Lütfen birkaç saniye bekleyip tekrar deneyin.";
    } else if (error.message && error.message.includes("GPT")) {
      errorMessage = "AI ile prompt parse edilirken bir hata oluştu. Lütfen prompt'unuzu kontrol edin veya daha basit bir ifade kullanın.";
    }
    
    res.status(500).send({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Görsel renk analizi endpoint'i
app.post("/api/images/analyze-colors", upload.array("images", 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send({
        success: false,
        error: "Lütfen en az bir görsel yükleyin",
      });
    }

    const colorsString = req.body.colors;
    if (!colorsString) {
      return res.status(400).send({
        success: false,
        error: "Renk listesi gereklidir",
      });
    }

    const colors = JSON.parse(colorsString);
    if (!Array.isArray(colors) || colors.length === 0) {
      return res.status(400).send({
        success: false,
        error: "Geçerli renk listesi gereklidir",
      });
    }

    // OpenAI API key kontrolü
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(400).send({
        success: false,
        error: "OpenAI API anahtarı bulunamadı. Lütfen .env dosyanızı kontrol edin.",
      });
    }

    const openai = new OpenAI({ apiKey });

    // Renk isimlerini normalize et (küçük harfe çevir, türkçe karakterleri düzelt)
    const normalizeColor = (color) => {
      return color.toLowerCase()
        .replace(/ı/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .trim();
    };

    const normalizedColors = colors.map(normalizeColor);
    const colorMapping = {};
    colors.forEach((color, index) => {
      colorMapping[normalizedColors[index]] = color;
    });

    // Frontend'den gönderilen imageId'leri al
    const imageIds = req.body.imageIds ? 
      (Array.isArray(req.body.imageIds) ? req.body.imageIds : [req.body.imageIds]) : 
      [];

    // Paralel işleme için tüm görselleri Promise array'ine çevir
    const analyzePromises = req.files.map(async (file, i) => {
      const imageId = imageIds[i] || file.originalname;
      
      try {
        // Görseli optimize et (boyut küçültme için)
        let imageBuffer = file.buffer;
        let mimeType = file.mimetype;
        
        // Eğer görsel büyükse (300KB'den büyük), resize yap
        // Bu hem API hızını artırır hem de veri kullanımını azaltır
        const MAX_WIDTH = 800; // Renk analizi için 800px yeterli
        const MAX_SIZE_KB = 300;
        
        // Görsel optimize et (sadece gerekirse)
        if (file.size > MAX_SIZE_KB * 1024 && file.mimetype.startsWith('image/')) {
          try {
            const sharpImage = sharp(file.buffer);
            const metadata = await sharpImage.metadata();
            
            // Eğer görsel çok büyükse resize yap
            if (metadata.width && (metadata.width > MAX_WIDTH || file.size > MAX_SIZE_KB * 1024)) {
              imageBuffer = await sharpImage
                .resize(MAX_WIDTH, null, {
                  withoutEnlargement: true, // Küçük görselleri büyütme
                  fit: 'inside', // Aspect ratio koru
                })
                .jpeg({ quality: 85, mozjpeg: true }) // JPEG formatına çevir ve optimize et
                .toBuffer();
              
              mimeType = 'image/jpeg'; // Resize sonrası JPEG kullan
              console.log(`Görsel ${file.originalname} optimize edildi: ${(file.size / 1024).toFixed(0)}KB -> ${(imageBuffer.length / 1024).toFixed(0)}KB`);
            }
          } catch (sharpError) {
            // Sharp hatası durumunda orijinal görseli kullan
            console.warn(`Görsel optimize edilemedi, orijinal kullanılıyor:`, sharpError.message);
            imageBuffer = file.buffer;
          }
        }
        
        // Görseli base64'e çevir
        const base64Image = imageBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        // OpenAI Vision API ile renk analizi (paralel çalışacak)
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini", // Hızlı ve ucuz model
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Bu görseldeki ürünün ana rengi nedir? Sadece şu renklerden birini seç (eğer yoksa en yakın olanı): ${colors.join(", ")}. Sadece renk ismini döndür, başka bir şey yazma.`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: dataUrl,
                  },
                },
              ],
            },
          ],
          max_tokens: 20, // Daha az token = daha hızlı yanıt
        });

        const detectedColor = response.choices[0].message.content.trim();
        const normalizedDetected = normalizeColor(detectedColor);

        // En yakın renk bul
        let matchedColor = null;

        // Direkt eşleşme kontrolü
        if (colorMapping[normalizedDetected]) {
          matchedColor = colorMapping[normalizedDetected];
        } else {
          // Kısmi eşleşme kontrolü
          for (const normalizedColor of normalizedColors) {
            if (normalizedDetected.includes(normalizedColor) || normalizedColor.includes(normalizedDetected)) {
              matchedColor = colorMapping[normalizedColor];
              break;
            }
          }
        }

        // Eşleşme bulunamazsa ilk rengi kullan
        if (!matchedColor) {
          matchedColor = colors[0];
        }

        return {
          imageId: imageId,
          color: matchedColor,
          confidence: matchedColor === colors[0] ? "low" : "medium",
        };
      } catch (error) {
        console.error(`Görsel ${file.originalname} analizi hatası:`, error);
        // Hata durumunda ilk rengi ata
        return {
          imageId: imageId,
          color: colors[0],
          confidence: "error",
        };
      }
    });

    // Tüm görselleri paralel olarak analiz et
    const matches = await Promise.all(analyzePromises);

    res.status(200).send({
      success: true,
      matches: matches,
    });
  } catch (error) {
    console.error("Renk analizi hatası:", error);
    res.status(500).send({
      success: false,
      error: error.message || "Renk analizi yapılırken bir hata oluştu",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Ürün varyantlarını listele
app.get("/api/variants/list", async (req, res) => {
  try {
    const { productId } = req.query;

    if (!productId) {
      return res.status(400).send({
        success: false,
        error: "Ürün ID gereklidir",
      });
    }

    const client = new shopify.api.clients.Graphql({
      session: res.locals.shopify.session,
    });

    const variantsQuery = `
      query getProductVariants($id: ID!) {
        product(id: $id) {
          id
          title
          options {
            id
            name
            values
          }
          variants(first: 250) {
            edges {
              node {
                id
                title
                price
                sku
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    `;

    const variantsData = await client.request(variantsQuery, {
      variables: { id: productId },
    });

    const product = variantsData.data.product;
    if (!product) {
      return res.status(404).send({
        success: false,
        error: "Ürün bulunamadı",
      });
    }

    const variants = product.variants.edges.map((edge) => ({
      id: edge.node.id,
      title: edge.node.title,
      price: edge.node.price,
      sku: edge.node.sku,
      inventoryQuantity: edge.node.inventoryQuantity,
      selectedOptions: edge.node.selectedOptions,
    }));

    res.status(200).send({
      success: true,
      product: {
        id: product.id,
        title: product.title,
        options: product.options,
      },
      variants,
    });
  } catch (error) {
    console.error("Varyant listesi hatası:", error);
    res.status(500).send({
      success: false,
      error: error.message || "Varyantlar listelenirken bir hata oluştu",
    });
  }
});

// Varyant silme (toplu)
app.post("/api/variants/delete", async (req, res) => {
  try {
    const { variantIds } = req.body;

    if (!variantIds || !Array.isArray(variantIds) || variantIds.length === 0) {
      return res.status(400).send({
        success: false,
        error: "Varyant ID'leri gereklidir",
      });
    }

    const client = new shopify.api.clients.Graphql({
      session: res.locals.shopify.session,
    });

    const deletedVariants = [];
    const errors = [];

    // Her varyantı tek tek sil (Shopify bulk delete mutation'ı yok)
    for (const variantId of variantIds) {
      try {
        const deleteMutation = `
          mutation productVariantDelete($id: ID!) {
            productVariantDelete(id: $id) {
              deletedProductVariantId
              userErrors {
                field
                message
              }
            }
          }
        `;

        const deleteResult = await client.request(deleteMutation, {
          variables: { id: variantId },
        });

        if (deleteResult.data.productVariantDelete.userErrors.length > 0) {
          errors.push({
            variantId,
            error: deleteResult.data.productVariantDelete.userErrors[0].message,
          });
        } else {
          deletedVariants.push(variantId);
        }
      } catch (error) {
        console.error(`Varyant ${variantId} silinirken hata:`, error);
        errors.push({
          variantId,
          error: error.message,
        });
      }
    }

    if (deletedVariants.length === 0) {
      return res.status(400).send({
        success: false,
        error: "Hiçbir varyant silinemedi",
        errors,
      });
    }

    res.status(200).send({
      success: true,
      deletedCount: deletedVariants.length,
      deletedVariants,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Varyant silme hatası:", error);
    res.status(500).send({
      success: false,
      error: error.message || "Varyantlar silinirken bir hata oluştu",
    });
  }
});

// Varyant kopyalama - Bir üründen diğerine varyant yapısını kopyala
app.post("/api/variants/copy", async (req, res) => {
  try {
    const { sourceProductId, targetProductId } = req.body;

    if (!sourceProductId || !targetProductId) {
      return res.status(400).send({
        success: false,
        error: "Kaynak ve hedef ürün ID'leri gereklidir",
      });
    }

    if (sourceProductId === targetProductId) {
      return res.status(400).send({
        success: false,
        error: "Kaynak ve hedef ürün aynı olamaz",
      });
    }

    const client = new shopify.api.clients.Graphql({
      session: res.locals.shopify.session,
    });

    // Kaynak ürünün varyantlarını al
    const sourceQuery = `
      query getSourceProduct($id: ID!) {
        product(id: $id) {
          id
          title
          options {
            id
            name
            values
          }
          variants(first: 250) {
            edges {
              node {
                id
                title
                price
                sku
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    `;

    const sourceData = await client.request(sourceQuery, {
      variables: { id: sourceProductId },
    });

    const sourceProduct = sourceData.data.product;
    if (!sourceProduct) {
      return res.status(404).send({
        success: false,
        error: "Kaynak ürün bulunamadı",
      });
    }

    // Hedef ürünün mevcut yapısını al
    const targetQuery = `
      query getTargetProduct($id: ID!) {
        product(id: $id) {
          id
          title
          options {
            id
            name
            values
          }
          variants(first: 250) {
            edges {
              node {
                id
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    `;

    const targetData = await client.request(targetQuery, {
      variables: { id: targetProductId },
    });

    const targetProduct = targetData.data.product;
    if (!targetProduct) {
      return res.status(404).send({
        success: false,
        error: "Hedef ürün bulunamadı",
      });
    }

    // Kaynak ürünün option'larını hedef ürüne kopyala (eğer yoksa)
    const sourceOptions = sourceProduct.options.filter(opt => opt.name.toLowerCase() !== "title");
    const targetOptions = targetProduct.options.filter(opt => opt.name.toLowerCase() !== "title");
    
    // Option mapping oluştur (kaynak -> hedef)
    const optionMapping = {};
    const newOptions = [];

    for (const sourceOpt of sourceOptions) {
      const targetOpt = targetOptions.find(
        t => t.name.toLowerCase() === sourceOpt.name.toLowerCase()
      );

      if (!targetOpt) {
        // Yeni option ekle
        newOptions.push({
          name: sourceOpt.name,
          values: sourceOpt.values,
        });
      } else {
        optionMapping[sourceOpt.name] = targetOpt.name;
      }
    }

    // Yeni option'lar varsa ekle (productSet ile)
    if (newOptions.length > 0) {
      const existingOptions = targetProduct.options
        .filter(opt => opt.name.toLowerCase() !== "title")
        .map(opt => ({
          name: opt.name,
          values: opt.values,
        }));

      const allOptions = [...existingOptions, ...newOptions];

      if (allOptions.length > 3) {
        return res.status(400).send({
          success: false,
          error: `Hedef ürüne option eklenemez. Shopify'da maksimum 3 option olabilir. Hedef üründe ${targetOptions.length}, eklemek istediğiniz ${newOptions.length} option var.`,
        });
      }

      // Option'ları ekle (productSet ile)
      const productSetMutation = `
        mutation productSet($input: ProductSetInput!) {
          productSet(input: $input) {
            product {
              id
              options {
                name
                values
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      await client.request(productSetMutation, {
        variables: {
          input: {
            productId: targetProductId,
            productOptionsToAdd: newOptions,
          },
        },
      });
    }

    // Varyantları oluştur
    const sourceVariants = sourceProduct.variants.edges.map(e => e.node);
    const createdVariants = [];
    const errors = [];

    // Hedef ürünün yeni option yapısını al (güncellenmiş)
    const updatedTargetData = await client.request(targetQuery, {
      variables: { id: targetProductId },
    });
    const updatedTargetOptions = updatedTargetData.data.product.options.filter(
      opt => opt.name.toLowerCase() !== "title"
    );

    // Her kaynak varyant için hedef üründe varyant oluştur
    for (const sourceVariant of sourceVariants) {
      try {
        // Option değerlerini map et
        const optionValues = sourceVariant.selectedOptions
          .filter(opt => opt.name.toLowerCase() !== "title")
          .map(sourceOpt => {
            const targetOptName = optionMapping[sourceOpt.name] || sourceOpt.name;
            const targetOpt = updatedTargetOptions.find(
              opt => opt.name.toLowerCase() === targetOptName.toLowerCase()
            );

            if (!targetOpt) {
              throw new Error(`Hedef üründe '${targetOptName}' option'ı bulunamadı`);
            }

            // Değer hedef option'da var mı kontrol et
            const valueExists = targetOpt.values.includes(sourceOpt.value);
            if (!valueExists && targetOpt.values.length > 0) {
              // Değer yoksa, ilk değeri kullan veya hata ver
              console.warn(`'${sourceOpt.value}' değeri hedef üründe yok, ilk değer kullanılıyor`);
              return {
              optionName: targetOpt.name,
              name: targetOpt.values[0],
            };
            }

            return {
              optionName: targetOpt.name,
              name: valueExists ? sourceOpt.value : targetOpt.values[0],
            };
          });

        // Varyant oluştur
        const variantCreateMutation = `
          mutation productVariantCreate($input: ProductVariantInput!) {
            productVariantCreate(input: $input) {
              productVariant {
                id
                title
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const variantResult = await client.request(variantCreateMutation, {
          variables: {
            input: {
              productId: targetProductId,
              optionValues: optionValues,
              price: sourceVariant.price,
              inventoryQuantities: sourceVariant.inventoryQuantity ? [{
                availableQuantity: sourceVariant.inventoryQuantity,
                locationId: "gid://shopify/Location/1", // Varsayılan location, gerekirse dinamik yapılabilir
              }] : undefined,
            },
          },
        });

        if (variantResult.data.productVariantCreate.userErrors.length > 0) {
          errors.push({
            variant: sourceVariant.title,
            error: variantResult.data.productVariantCreate.userErrors[0].message,
          });
        } else {
          createdVariants.push(variantResult.data.productVariantCreate.productVariant);
        }
      } catch (error) {
        console.error(`Varyant ${sourceVariant.title} kopyalanırken hata:`, error);
        errors.push({
          variant: sourceVariant.title,
          error: error.message,
        });
      }
    }

    res.status(200).send({
      success: true,
      copiedCount: createdVariants.length,
      createdVariants,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Varyant kopyalama hatası:", error);
    res.status(500).send({
      success: false,
      error: error.message || "Varyantlar kopyalanırken bir hata oluştu",
    });
  }
});

// CSV Export - Varyantları CSV formatında export et
app.get("/api/variants/export-csv", async (req, res) => {
  try {
    const { productId } = req.query;

    if (!productId) {
      return res.status(400).send({
        success: false,
        error: "Ürün ID gereklidir",
      });
    }

    const client = new shopify.api.clients.Graphql({
      session: res.locals.shopify.session,
    });

    const variantsQuery = `
      query getProductVariants($id: ID!) {
        product(id: $id) {
          id
          title
          variants(first: 250) {
            edges {
              node {
                id
                title
                price
                sku
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    `;

    const variantsData = await client.request(variantsQuery, {
      variables: { id: productId },
    });

    const product = variantsData.data.product;
    if (!product) {
      return res.status(404).send({
        success: false,
        error: "Ürün bulunamadı",
      });
    }

    const variants = product.variants.edges.map((edge) => edge.node);

    // CSV header
    const headers = ["Varyant ID", "Varyant Adı", "Fiyat", "SKU", "Stok"];
    
    // Option'ları header'a ekle
    if (variants.length > 0) {
      variants[0].selectedOptions.forEach(opt => {
        if (opt.name.toLowerCase() !== "title") {
          headers.push(opt.name);
        }
      });
    }

    // CSV rows
    const rows = variants.map(variant => {
      const row = [
        variant.id,
        variant.title,
        variant.price,
        variant.sku || "",
        variant.inventoryQuantity || 0,
      ];

      // Option değerlerini ekle
      variant.selectedOptions.forEach(opt => {
        if (opt.name.toLowerCase() !== "title") {
          row.push(opt.value);
        }
      });

      return row;
    });

    // CSV oluştur
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    // BOM ekle (Excel için UTF-8 desteği)
    const csvWithBom = "\ufeff" + csvContent;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="variants-${product.title.replace(/[^a-z0-9]/gi, "_")}-${Date.now()}.csv"`);
    res.send(csvWithBom);
  } catch (error) {
    console.error("CSV export hatası:", error);
    res.status(500).send({
      success: false,
      error: error.message || "CSV export yapılırken bir hata oluştu",
    });
  }
});

// CSV Import - CSV'den varyantları import et
app.post("/api/variants/import-csv", upload.single("csv"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({
        success: false,
        error: "CSV dosyası gereklidir",
      });
    }

    const { productId } = req.body;

    if (!productId) {
      return res.status(400).send({
        success: false,
        error: "Ürün ID gereklidir",
      });
    }

    const csvContent = req.file.buffer.toString("utf-8").replace(/^\ufeff/, ""); // BOM'u kaldır
    const lines = csvContent.split("\n").filter(line => line.trim());

    if (lines.length < 2) {
      return res.status(400).send({
        success: false,
        error: "CSV dosyası en az 1 satır veri içermelidir",
      });
    }

    // Header'ı parse et
    const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());

    // Ürünü al
    const client = new shopify.api.clients.Graphql({
      session: res.locals.shopify.session,
    });

    const productQuery = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          options {
            id
            name
            values
          }
          variants(first: 250) {
            edges {
              node {
                id
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    `;

    const productData = await client.request(productQuery, {
      variables: { id: productId },
    });

    const product = productData.data.product;
    if (!product) {
      return res.status(404).send({
        success: false,
        error: "Ürün bulunamadı",
      });
    }

    const optionNames = product.options
      .filter(opt => opt.name.toLowerCase() !== "title")
      .map(opt => opt.name);

    // CSV satırlarını parse et
    const updatedVariants = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = line.split(",").map(v => v.replace(/^"|"$/g, "").trim());

      try {
        // Varyant ID'yi bul
        const variantIdIndex = headers.indexOf("Varyant ID");
        if (variantIdIndex === -1) {
          throw new Error("CSV'de 'Varyant ID' sütunu bulunamadı");
        }

        const variantId = values[variantIdIndex];
        if (!variantId) {
          continue; // Varyant ID yoksa atla
        }

        // Mevcut varyantı bul
        const existingVariant = product.variants.edges.find(
          e => e.node.id === variantId
        );

        if (!existingVariant) {
          errors.push({
            row: i + 1,
            error: "Varyant bulunamadı",
          });
          continue;
        }

        // Güncellenecek alanları hazırla
        const updateInput = {
          id: variantId,
        };

        // Fiyat
        const priceIndex = headers.indexOf("Fiyat");
        if (priceIndex !== -1 && values[priceIndex]) {
          updateInput.price = values[priceIndex];
        }

        // SKU
        const skuIndex = headers.indexOf("SKU");
        if (skuIndex !== -1 && values[skuIndex]) {
          updateInput.sku = values[skuIndex];
        }

        // Stok
        const stockIndex = headers.indexOf("Stok");
        if (stockIndex !== -1 && values[stockIndex]) {
          // Location ID gerekli, şimdilik atlıyoruz
          // updateInput.inventoryQuantities = [{
          //   availableQuantity: parseInt(values[stockIndex]) || 0,
          //   locationId: "gid://shopify/Location/1",
          // }];
        }

        // Varyantı güncelle
        const variantUpdateMutation = `
          mutation productVariantUpdate($input: ProductVariantInput!) {
            productVariantUpdate(input: $input) {
              productVariant {
                id
                title
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const updateResult = await client.request(variantUpdateMutation, {
          variables: {
            input: updateInput,
          },
        });

        if (updateResult.data.productVariantUpdate.userErrors.length > 0) {
          errors.push({
            row: i + 1,
            error: updateResult.data.productVariantUpdate.userErrors[0].message,
          });
        } else {
          updatedVariants.push(updateResult.data.productVariantUpdate.productVariant);
        }
      } catch (error) {
        console.error(`Satır ${i + 1} işlenirken hata:`, error);
        errors.push({
          row: i + 1,
          error: error.message,
        });
      }
    }

    res.status(200).send({
      success: true,
      updatedCount: updatedVariants.length,
      updatedVariants,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("CSV import hatası:", error);
    res.status(500).send({
      success: false,
      error: error.message || "CSV import yapılırken bir hata oluştu",
    });
  }
});

// Görselleri Shopify'a yükle ve varyantlara ata
app.post("/api/images/upload-to-shopify", upload.array("images", 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send({
        success: false,
        error: "Lütfen en az bir görsel yükleyin",
      });
    }

    const { productId, imageColorMatches } = req.body;

    if (!productId) {
      return res.status(400).send({
        success: false,
        error: "Ürün ID gereklidir",
      });
    }

    const matches = JSON.parse(imageColorMatches || "{}");

    const client = new shopify.api.clients.Graphql({
      session: res.locals.shopify.session,
    });

    // Önce ürünün varyantlarını, renk option'ını ve mevcut görsellerini al
    const productQuery = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          options {
            id
            name
            values
          }
          media(first: 250) {
            edges {
              node {
                id
                ... on MediaImage {
                  id
                  image {
                    id
                    url
                  }
                }
              }
            }
          }
          variants(first: 250) {
            edges {
              node {
                id
                title
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    `;

    const productData = await client.request(productQuery, {
      variables: { id: productId },
    });

    const product = productData.data.product;
    if (!product) {
      return res.status(404).send({
        success: false,
        error: "Ürün bulunamadı",
      });
    }

    // Mevcut görselleri sil (her yüklemede sıfırdan başlamak için)
    const existingMedia = product.media.edges.map(edge => edge.node).filter(media => media.id);
    if (existingMedia.length > 0) {
      console.log(`${existingMedia.length} mevcut görsel siliniyor...`);
      
      const deleteMediaMutation = `
        mutation productDeleteMedia($productId: ID!, $mediaIds: [ID!]!) {
          productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
            deletedMediaIds
            mediaUserErrors {
              field
              message
            }
          }
        }
      `;

      try {
        // Media ID'lerini topla
        const mediaIds = existingMedia.map(media => media.id);
        
        // Shopify API limiti nedeniyle 50'şer 50'şer sil
        for (let i = 0; i < mediaIds.length; i += 50) {
          const batch = mediaIds.slice(i, i + 50);
          const deleteResult = await client.request(deleteMediaMutation, {
            variables: {
              productId: productId,
              mediaIds: batch,
            },
          });

          if (deleteResult.data.productDeleteMedia.mediaUserErrors.length > 0) {
            console.warn("Bazı görseller silinirken hata:", deleteResult.data.productDeleteMedia.mediaUserErrors);
          } else {
            console.log(`${batch.length} görsel başarıyla silindi`);
          }
        }
      } catch (deleteError) {
        console.warn("Mevcut görseller silinirken hata (devam ediliyor):", deleteError.message);
        // Hata olsa bile devam et, yeni görselleri yüklemeye çalış
      }
    }

    // Renk option'ını bul
    const colorOption = product.options.find(
      opt => opt.name.toLowerCase() === "renk" || opt.name.toLowerCase() === "color"
    );

    if (!colorOption) {
      return res.status(400).send({
        success: false,
        error: "Üründe 'Renk' option'ı bulunamadı. Lütfen önce varyantları oluşturun.",
      });
    }

    const uploadedMedia = [];
    const errors = [];

    // Her görsel için
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const imageId = req.body.imageIds ? 
        (Array.isArray(req.body.imageIds) ? req.body.imageIds[i] : req.body.imageIds) : 
        `image-${i}`;
      
      const colorName = matches[imageId] || matches[file.originalname];

      if (!colorName) {
        errors.push(`Görsel ${file.originalname} için renk eşleştirmesi bulunamadı`);
        continue;
      }

      try {
        let imageBuffer = file.buffer;
        let mimeType = file.mimetype;
        const sanitizeFilename = (name, fallbackExt = "jpg") => {
          const parts = name.split(".");
          let base = parts.slice(0, -1).join(".") || parts[0] || "image";
          base = base
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9-_]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 80) || "image";
          const ext = parts.length > 1 ? parts[parts.length - 1] : fallbackExt;
          return `${base}.${ext.toLowerCase()}`;
        };
        let uploadFilename = sanitizeFilename(file.originalname || "image.jpg", "jpg");

        // Görsel optimize et (gerekirse)
        if (file.mimetype.startsWith('image/')) {
          try {
            const sharpImage = sharp(file.buffer);
            const metadata = await sharpImage.metadata();
            const MAX_WIDTH = 800;
            const MAX_SIZE_KB = 300;

            if (
              metadata.width &&
              (metadata.width > MAX_WIDTH || file.size > MAX_SIZE_KB * 1024)
            ) {
              const resized = sharpImage.resize(MAX_WIDTH, null, {
                withoutEnlargement: true,
                fit: 'inside',
              });

              // Formatı koru
              imageBuffer = await resized.toBuffer();
            }

            // Eğer format bilinmiyorsa fallback olarak orijinali kullan
            if (metadata.format) {
              mimeType = `image/${metadata.format === 'jpg' ? 'jpeg' : metadata.format}`;
              // Shopify staged upload ile uyumlu olması için dosya uzantısını güncelle
              const ext = metadata.format === 'jpg' ? 'jpeg' : metadata.format;
              uploadFilename = sanitizeFilename(uploadFilename, ext);
            }
          } catch (sharpError) {
            console.warn(`Görsel optimize edilemedi, orijinal kullanılıyor:`, sharpError.message);
            imageBuffer = file.buffer;
            mimeType = file.mimetype;
            uploadFilename = sanitizeFilename(file.originalname || "image.jpg", "jpg");
          }
        }

        const uploadFileSize = imageBuffer.length;
        
        // Staged uploads oluştur (modern yöntem)
        const stagedUploadsCreate = `
          mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
            stagedUploadsCreate(input: $input) {
              stagedTargets {
                resourceUrl
                url
                parameters {
                  name
                  value
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const stagedResult = await client.request(stagedUploadsCreate, {
          variables: {
            input: [{
              resource: "IMAGE",
              filename: uploadFilename,
              mimeType: mimeType,
              fileSize: uploadFileSize.toString(),
            }],
          },
        });

        const stagedTarget = stagedResult.data.stagedUploadsCreate.stagedTargets[0];
        if (!stagedTarget) {
          throw new Error("Staged upload oluşturulamadı");
        }
        console.log(
          "Staged upload target raw:",
          JSON.stringify(stagedTarget, null, 2)
        );

        const headers = {
          "Content-Type": mimeType,
          "Content-Length": imageBuffer.length.toString(),
        };

        const response = await (
          globalThis.fetch || (await import("node-fetch")).default
        )(stagedTarget.url, {
          method: "PUT",
          body: imageBuffer,
          headers,
        });

        if (!response.ok) {
          const body = await response.text();
          console.error(
            "Staged upload response error:",
            response.status,
            response.statusText,
            body
          );
          throw new Error(
            `Görsel yükleme başarısız: ${response.statusText || response.status}`
          );
        }

        // Görseli ürünün media'sına ekle (fileCreate gereksiz, productCreateMedia yeterli)
        const productCreateMedia = `
          mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
            productCreateMedia(productId: $productId, media: $media) {
              media {
                id
                ... on MediaImage {
                  id
                  image {
                    id
                    url
                  }
                }
              }
              mediaUserErrors {
                field
                message
              }
            }
          }
        `;

        const mediaResult = await client.request(productCreateMedia, {
          variables: {
            productId: productId,
            media: [{
              mediaContentType: "IMAGE",
              originalSource: stagedTarget.resourceUrl,
            }],
          },
        });

        console.log("productCreateMedia FULL response:", JSON.stringify(mediaResult.data, null, 2));

        if (mediaResult.data.productCreateMedia.mediaUserErrors.length > 0) {
          throw new Error(
            mediaResult.data.productCreateMedia.mediaUserErrors[0]?.message ||
            "Görsel ürüne eklenemedi"
          );
        }

        const addedMedia = mediaResult.data.productCreateMedia.media?.[0];
        if (!addedMedia) {
          console.error("productCreateMedia media array boş veya undefined:", mediaResult.data);
          throw new Error("Görsel ürüne eklenemedi: media array boş");
        }
        
        console.log("productCreateMedia addedMedia:", JSON.stringify(addedMedia, null, 2));
        
        // productImageId'yi al - MediaImage'den image.id'yi çıkar
        let productImageId = null;
        if (addedMedia?.image?.id) {
          productImageId = addedMedia.image.id;
        } else {
          // image.id null ise, productCreateMedia asenkron çalışıyor olabilir
          // Kısa bir bekleme sonrası ürünü query edip yeni eklenen görseli bul
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
          
          // Ürünü tekrar query edip yeni eklenen görseli bul
          const productWithImagesQuery = `
            query getProductImages($id: ID!) {
              product(id: $id) {
                id
                images(first: 250) {
                  edges {
                    node {
                      id
                      url
                    }
                  }
                }
              }
            }
          `;
          
          const productImagesData = await client.request(productWithImagesQuery, {
            variables: { id: productId },
          });
          
          // En son eklenen görseli bul (resourceUrl ile eşleşen)
          const images = productImagesData.data.product.images.edges.map(e => e.node);
          const filename = stagedTarget.resourceUrl.split('/').pop()?.split('?')[0] || '';
          const matchingImage = images.find(img => 
            img.url && (img.url.includes(filename) || filename.includes(img.url.split('/').pop()?.split('?')[0] || ''))
          );
          
          if (matchingImage) {
            productImageId = matchingImage.id;
            console.log(`Görsel eşleştirildi: ${filename} -> ${matchingImage.id}`);
          } else if (images.length > 0) {
            // Eşleşme bulunamazsa en son eklenen görseli kullan
            productImageId = images[images.length - 1].id;
            console.log(`Eşleşme bulunamadı, en son görsel kullanılıyor: ${productImageId}`);
          }
        }
        
        if (!productImageId) {
          console.error("productCreateMedia full response:", JSON.stringify(mediaResult.data, null, 2));
          console.error("Ürün görselleri:", productImagesData?.data?.product?.images?.edges?.map(e => e.node));
          throw new Error("Yeni eklenen görsel için product image ID alınamadı");
        }
        
        console.log(`productImageId bulundu: ${productImageId}`);
        
        // Bu renge ait varyantları bul ve görseli ata
        const matchingVariants = product.variants.edges
          .filter(edge => {
            const variant = edge.node;
            const colorOption = variant.selectedOptions.find(
              opt => opt.name.toLowerCase() === "renk" || opt.name.toLowerCase() === "color"
            );
            return colorOption && colorOption.value.toLowerCase() === colorName.toLowerCase();
          })
          .map(edge => edge.node.id);

        if (matchingVariants.length > 0 && productImageId) {
          // Önce tüm varyantların mevcut görsellerini kontrol et
          const variantsToUpdate = [];
          for (const variantId of matchingVariants) {
            const variantQuery = `
              query getVariant($id: ID!) {
                productVariant(id: $id) {
                  id
                  image {
                    id
                  }
                }
              }
            `;

            try {
              const variantData = await client.request(variantQuery, {
                variables: { id: variantId },
              });

              // Eğer varyantın görseli yoksa, güncelleme listesine ekle
              if (!variantData.data.productVariant.image) {
                variantsToUpdate.push({
                  id: variantId,
                  imageId: productImageId,
                });
              }
            } catch (queryError) {
              console.warn(`Varyant ${variantId} query hatası:`, queryError.message);
            }
          }

          // REST API kullanarak varyantlara görsel ata (GraphQL'de imageId field'ı yok)
          if (variantsToUpdate.length > 0) {
            try {
              // GraphQL ID'lerini REST API ID'lerine çevir
              const extractId = (gid) => {
                const match = gid.match(/\/\d+$/);
                return match ? match[0].substring(1) : null;
              };

              const productIdRest = extractId(productId);
              const imageIdRest = extractId(productImageId);

              if (!productIdRest || !imageIdRest) {
                throw new Error("ID çevirme hatası");
              }

              // REST API client oluştur
              const restClient = new shopify.api.clients.Rest({
                session: res.locals.shopify.session,
              });

              // Her varyantı tek tek güncelle (REST API'de bulk update yok)
              let successCount = 0;
              for (const variant of variantsToUpdate) {
                try {
                  const variantIdRest = extractId(variant.id);
                  if (!variantIdRest) continue;

                  // REST API ile varyantı güncelle
                  await restClient.put({
                    path: `products/${productIdRest}/variants/${variantIdRest}`,
                    data: {
                      variant: {
                        image_id: parseInt(imageIdRest),
                      },
                    },
                  });

                  successCount++;
                } catch (variantError) {
                  console.warn(`Varyant ${variant.id} görsel atama hatası:`, variantError.message);
                }
              }

              if (successCount > 0) {
                console.log(`${successCount}/${variantsToUpdate.length} varyant için görsel başarıyla atandı: ${productImageId}`);
              } else {
                console.warn("Hiçbir varyanta görsel atanamadı");
              }
            } catch (restError) {
              console.error(`REST API ile varyant görsel atama hatası:`, restError.message);
              // Hata olsa bile devam et, görsel zaten ürüne eklenmiş
            }
          }
        }

        uploadedMedia.push({
          imageId: imageId,
          colorName: colorName,
          mediaId: addedMedia.id,
          productImageId,
          variantIds: matchingVariants,
        });
      } catch (error) {
        console.error(`Görsel ${file.originalname} yüklenirken hata:`, error);
        errors.push(`${file.originalname}: ${error.message}`);
      }
    }

    if (uploadedMedia.length === 0) {
      return res.status(400).send({
        success: false,
        error: "Hiçbir görsel yüklenemedi. Hatalar: " + errors.join(", "),
      });
    }

    res.status(200).send({
      success: true,
      uploaded: uploadedMedia.length,
      errors: errors.length > 0 ? errors : undefined,
      media: uploadedMedia,
    });
  } catch (error) {
    console.error("Shopify görsel yükleme hatası:", error);
    res.status(500).send({
      success: false,
      error: error.message || "Görseller yüklenirken bir hata oluştu",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// ============================================================================
// SCENARIO 6: Static file serving - API route'larından SONRA olmalı
// ============================================================================
// CRITICAL: CSP headers ve static file serving'i EN SONA koy
// API route'ları öncelikli olmalı
app.use(shopify.cspHeaders());
// CRITICAL: Static file serving'i EN SONA koy
// /api/* route'ları zaten yukarıda tanımlı, bu yüzden öncelikli olacak
// Ama yine de ekstra güvenlik için kontrol ekle
app.use((req, res, next) => {
  // Eğer request /api ile başlıyorsa, static file serving'i ATLA
  // Bu endpoint zaten yukarıda handle edilmiş olmalı
  if (req.path && req.path.startsWith('/api/')) {
    console.warn("⚠️ /api/* request static file serving'e ulaştı - bu olmamalı!");
    console.warn("⚠️ Request path:", req.path);
    console.warn("⚠️ Request method:", req.method);
    // Eğer buraya geldiyse, endpoint'e ulaşmamış demektir
    // 404 döndür
    return res.status(404).json({ 
      error: "API endpoint not found",
      path: req.path 
    });
  }
  // Diğer request'ler için static file serving'i kullan
  serveStatic(STATIC_PATH, { index: false })(req, res, next);
});

// SCENARIO 7: Catch-all route - EN SONA koy (API route'larından sonra)
app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(
      readFileSync(join(STATIC_PATH, "index.html"))
        .toString()
        .replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || "")
    );
});

app.listen(PORT);
