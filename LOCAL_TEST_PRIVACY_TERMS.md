# Local Test: Privacy Policy ve Terms of Service

## Test Adımları

1. **Backend'i başlat:**
   ```bash
   cd web
   npm run dev
   ```

2. **Browser'da test et:**
   - Privacy Policy: http://localhost:3000/privacy
   - Terms of Service: http://localhost:3000/terms

3. **Beklenen sonuç:**
   - Her iki sayfa da güzel formatlanmış HTML olarak görünmeli
   - Markdown içeriği düzgün şekilde HTML'e çevrilmeli
   - Stil uygulanmış olmalı (başlıklar, listeler, paragraflar)

## Production Test (Railway Deploy Sonrası)

1. Railway URL'ini al (örnek: `https://autovariant-production.up.railway.app`)
2. Test URL'leri:
   - Privacy Policy: `https://[your-railway-url]/privacy`
   - Terms of Service: `https://[your-railway-url]/terms`

## Shopify App Store İçin

Bu URL'leri Shopify Partners Dashboard'da kullan:
- Privacy Policy URL: `https://[your-railway-url]/privacy`
- Terms of Service URL: `https://[your-railway-url]/terms`

