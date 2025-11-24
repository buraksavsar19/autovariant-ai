# 🚀 Shopify App Store Yayınlama Rehberi

Bu rehber, Autovariant AI uygulamanızı Shopify App Store'a yayınlamak için gereken tüm adımları içerir.

---

## 📋 İÇİNDEKİLER

1. [Hazırlık Aşaması](#1-hazırlık-aşaması)
2. [Production Deployment](#2-production-deployment)
3. [App Store Listing Hazırlığı](#3-app-store-listing-hazırlığı)
4. [Shopify Partners Dashboard Ayarları](#4-shopify-partners-dashboard-ayarları)
5. [App Review Süreci](#5-app-review-süreci)
6. [Yayınlama Sonrası](#6-yayınlama-sonrası)

---

## 1. HAZIRLIK AŞAMASI

### 1.1 Shopify Partner Hesabı Oluşturma

1. **Shopify Partners'a Git:**
   - https://partners.shopify.com adresine git
   - "Sign up" butonuna tıkla
   - Email, şifre ve şirket bilgilerini gir

2. **Hesap Doğrulama:**
   - Email'ini kontrol et ve doğrula
   - Gerekli bilgileri tamamla (şirket adı, ülke, vb.)

### 1.2 App Oluşturma (Partners Dashboard'da)

1. **Yeni App Oluştur:**
   - Partners Dashboard'da "Apps" sekmesine git
   - "Create app" butonuna tıkla
   - App adını gir: **"Autovariant AI"**
   - App URL: Şimdilik `https://example.com` (sonra güncelleyeceğiz)

2. **App Bilgilerini Kaydet:**
   - `SHOPIFY_API_KEY` ve `SHOPIFY_API_SECRET` değerlerini not al
   - Bu değerler `shopify.app.toml` dosyasında zaten var

### 1.3 Gerekli Dosyaları Kontrol Et

Aşağıdaki dosyaların mevcut olduğundan emin ol:

- ✅ `shopify.app.toml` - App konfigürasyonu
- ✅ `SECURITY.md` - Güvenlik politikası
- ✅ `privacy.js` - Privacy webhook handler
- ⚠️ `PRIVACY.md` - Privacy Policy (oluşturulmalı)
- ⚠️ `TERMS.md` - Terms of Service (oluşturulmalı)

---

## 2. PRODUCTION DEPLOYMENT

### 2.1 Hosting Seçimi

**Önerilen: Railway.app** (En kolay ve hızlı)

Alternatifler:
- Heroku
- Fly.io
- Render
- DigitalOcean App Platform

### 2.3 Railway ile Deployment (Önerilen)

#### Adım 1: Railway Hesabı Oluştur
1. https://railway.app adresine git
2. "Start a New Project" tıkla
3. Email ile hesap oluştur veya giriş yap

#### Adım 2: Railway CLI ile Deploy
1. Terminal'de Railway CLI'yi yükle: `npm i -g @railway/cli`
2. Railway'e giriş yap: `railway login`
3. Proje klasörüne git: `cd /Users/buraksavsar/Desktop/autovariant-ai`
4. Railway projesi oluştur: `railway init`
5. Projeyi deploy et: `railway up`

#### Adım 3: Environment Variables Ayarla
Railway Dashboard'da "Variables" sekmesine git ve şunları ekle:

```
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SCOPES=write_products
OPENAI_API_KEY=your_openai_key_here
NODE_ENV=production
```

#### Adım 4: Domain Ayarla
1. Railway'de "Settings" > "Generate Domain" tıkla
2. Oluşan domain'i kopyala (örn: `autovariant-ai-production.up.railway.app`)
3. Bu domain'i not al (sonraki adımda kullanacağız)

### 2.4 shopify.app.toml Güncelleme

Production domain'inizi `shopify.app.toml` dosyasına ekle:

```toml
application_url = "https://autovariant-ai-production.up.railway.app"
redirect_urls = [ "https://autovariant-ai-production.up.railway.app/api/auth" ]
```

### 2.5 Partners Dashboard'da URL'leri Güncelle

1. Partners Dashboard'da app'inize gidin
2. "App setup" sekmesine gidin
3. Şu alanları güncelleyin:
   - **App URL:** Production domain'iniz
   - **Allowed redirection URL(s):** Production domain + `/api/auth`

### 2.6 Production'da Test Et

1. Test store'unuzda app'i yükleyin
2. Tüm özellikleri test edin:
   - ✅ Ürün seçimi
   - ✅ Varyant oluşturma
   - ✅ Görsel yükleme
   - ✅ Renk eşleştirme
   - ✅ Template sistemi

---

## 3. APP STORE LISTING HAZIRLIĞI

### 3.1 App İkonu Hazırlama

**Gereksinimler:**
- Format: PNG
- Boyut: 512x512 piksel
- Arka plan: Şeffaf veya düz renk
- İçerik: App'inizi temsil eden bir logo

**Öneriler:**
- Canva.com kullanarak ücretsiz logo oluşturabilirsiniz
- Veya Fiverr'da bir tasarımcıya yaptırabilirsiniz ($5-20)

### 3.2 Screenshot'lar Hazırlama

**Gereksinimler:**
- En az 3 screenshot (önerilen: 5-7)
- Boyut: 1200x800 piksel (16:10 oran)
- Format: PNG veya JPG
- Her screenshot farklı bir özelliği göstermeli

**Önerilen Screenshot'lar:**
1. **Ana Ekran:** Varyant oluşturma arayüzü
2. **AI Prompt:** Doğal dil ile varyant oluşturma
3. **Görsel Eşleştirme:** Renk analizi ve görsel atama
4. **Template Sistemi:** Kaydedilmiş template'ler
5. **Önizleme:** Oluşturulacak varyantların önizlemesi
6. **Başarı Ekranı:** İşlem tamamlandı ekranı

**Screenshot Alma:**
- Chrome DevTools'u aç (F12)
- Device Toolbar'ı aç (Ctrl+Shift+M)
- Boyutu 1200x800'e ayarla
- Screenshot al (Windows: Win+Shift+S, Mac: Cmd+Shift+4)

### 3.3 App Açıklaması Yazma

**Gereksinimler:**
- Maksimum 500 karakter
- İngilizce (veya Türkçe, ama İngilizce önerilir)
- App'in değer önerisini açıkça belirtmeli

**Örnek Açıklama:**

```
Autovariant AI - AI-Powered Product Variant Creator

Create product variants in seconds using natural language! Simply describe your variants (sizes, colors, prices) and let AI do the rest.

✨ Key Features:
• Natural language variant creation - "S to 3XL, red green blue, $50"
• AI-powered color matching from images
• Bulk variant creation for multiple products
• Save templates for quick reuse
• Smart price and stock rules

Save hours of manual work. Perfect for fashion, apparel, and any product with multiple variants.

No coding required. Just describe, preview, and create!
```

### 3.4 Privacy Policy Oluşturma

`PRIVACY.md` dosyası oluştur:

```markdown
# Privacy Policy

**Last Updated:** [Tarih]

## Information We Collect

Autovariant AI collects the following information:
- Product data (names, variants, prices, images)
- Store information (shop domain, API access)

## How We Use Your Information

We use collected information solely to:
- Create and manage product variants
- Match images to variants
- Provide app functionality

## Data Storage

- All data is stored securely
- We do not share your data with third parties
- Data is deleted when you uninstall the app

## Your Rights

You can request access, modification, or deletion of your data at any time by contacting [support email].

## Contact

For privacy concerns, contact: [your-email@example.com]
```

### 3.5 Terms of Service Oluşturma

`TERMS.md` dosyası oluştur:

```markdown
# Terms of Service

**Last Updated:** [Tarih]

## Acceptance of Terms

By using Autovariant AI, you agree to these terms.

## Service Description

Autovariant AI is a Shopify app that helps merchants create product variants using AI.

## User Responsibilities

- You are responsible for the accuracy of product data
- You must have permission to modify products
- You agree not to misuse the service

## Limitation of Liability

Autovariant AI is provided "as is". We are not liable for any damages resulting from use of the app.

## Changes to Terms

We reserve the right to modify these terms at any time.

## Contact

For questions, contact: [your-email@example.com]
```

---

## 4. SHOPIFY PARTNERS DASHBOARD AYARLARI

### 4.1 App Store Listing Sekmesi

Partners Dashboard'da app'inize gidin ve "App Store listing" sekmesine tıklayın.

### 4.2 Zorunlu Alanları Doldur

1. **App Name:** Autovariant AI
2. **Short Description:** (500 karakter max)
   ```
   Create product variants in seconds using AI and natural language. Perfect for fashion and apparel stores.
   ```
3. **Long Description:** (4000 karakter max)
   - App'in tüm özelliklerini detaylıca anlat
   - Kullanım senaryolarını ekle
   - Avantajları listele

4. **App Icon:** 512x512 PNG yükle

5. **Screenshots:** En az 3 screenshot yükle

6. **Categories:** 
   - Primary: "Product management"
   - Secondary: "Inventory management" (opsiyonel)

7. **Support Email:** Destek email'iniz

8. **Support URL:** (Opsiyonel) Destek sayfanız varsa

9. **Marketing URL:** (Opsiyonel) Landing page'iniz varsa

10. **Privacy Policy URL:** 
    - Railway static files kullanabilirsiniz
    - Veya kendi domain'inizde yayınlayın
    - Örnek: `https://yourdomain.com/privacy` veya `https://your-app.railway.app/privacy`

11. **Terms of Service URL:**
    - Örnek: `https://yourdomain.com/terms`

### 4.3 Pricing Ayarları

**Seçenekler:**
1. **Free** - Ücretsiz
2. **One-time charge** - Tek seferlik ödeme
3. **Recurring charge** - Aylık/yıllık abonelik
4. **Usage-based** - Kullanım bazlı

**Önerilen Model:**
- **Free Plan:** 10 varyant/ay
- **Pro Plan:** $9.99/ay - Sınırsız varyant
- **Enterprise:** Özel fiyatlandırma

Pricing ayarlarını yapmak için:
1. "Pricing" sekmesine git
2. Plan'ları oluştur
3. Her plan için özellikleri belirle

### 4.4 App Capabilities

Şu özellikleri işaretle:
- ✅ Admin embedded app
- ✅ Uses Shopify APIs
- ✅ Requires OAuth

### 4.5 Required App Capabilities

Zorunlu webhook'ları kontrol et:
- ✅ CUSTOMERS_DATA_REQUEST
- ✅ CUSTOMERS_REDACT
- ✅ SHOP_REDACT

(Bunlar `privacy.js` dosyasında zaten var)

---

## 5. APP REVIEW SÜRECİ

### 5.1 Pre-Submission Checklist

Göndermeden önce kontrol et:

- [ ] Production'da deploy edildi
- [ ] Tüm özellikler test edildi
- [ ] App icon hazır (512x512)
- [ ] En az 3 screenshot hazır
- [ ] App açıklaması yazıldı
- [ ] Privacy Policy oluşturuldu ve yayınlandı
- [ ] Terms of Service oluşturuldu ve yayınlandı
- [ ] Support email belirlendi
- [ ] Pricing ayarlandı (eğer ücretli ise)
- [ ] Test store'da her şey çalışıyor
- [ ] Console'da hata yok
- [ ] Mobile responsive
- [ ] Loading states var
- [ ] Error handling var

### 5.2 Test Store Hazırlama

Shopify, review için bir test store ister:

1. **Development Store Oluştur:**
   - Partners Dashboard > Stores > Add store
   - "Development store" seç
   - Store adı: "Autovariant AI Test Store"

2. **Test Store'u Hazırla:**
   - En az 2-3 test ürünü ekle
   - App'i yükle
   - Tüm özellikleri test et
   - Screenshot'lar için hazır hale getir

3. **Test Store Bilgilerini Not Al:**
   - Store URL: `test-store.myshopify.com`
   - Admin email ve şifre

### 5.3 Review Gönderme

1. Partners Dashboard'da app'inize gidin
2. "App Store listing" sekmesine gidin
3. Tüm alanların doldurulduğundan emin olun
4. "Submit for review" butonuna tıklayın
5. Test store bilgilerini girin
6. Gönder

### 5.4 Review Süreci

**Beklenen Süre:** 5-10 iş günü

**Shopify Kontrol Edecek:**
- ✅ App çalışıyor mu?
- ✅ Tüm özellikler çalışıyor mu?
- ✅ Privacy Policy ve Terms var mı?
- ✅ Security standartlarına uygun mu?
- ✅ UI/UX kaliteli mi?
- ✅ Hata yönetimi var mı?

**Olası Sonuçlar:**
1. **Approved** ✅ - App onaylandı, yayınlandı!
2. **Changes Requested** ⚠️ - Düzeltmeler gerekli
3. **Rejected** ❌ - Reddedildi (nadir)

### 5.5 Changes Requested Durumunda

Eğer Shopify düzeltme isterse:
1. Email'deki feedback'i oku
2. Gerekli değişiklikleri yap
3. Production'a deploy et
4. "Resubmit for review" tıkla

---

## 6. YAYINLAMA SONRASI

### 6.1 App Yayınlandıktan Sonra

1. **App Store'da Kontrol Et:**
   - Shopify App Store'da app'inizi arayın
   - Listing'in doğru göründüğünden emin olun

2. **İlk Kullanıcıları Bekle:**
   - İlk birkaç gün yavaş olabilir
   - Kullanıcı geri bildirimlerini topla

3. **Monitoring:**
   - Error tracking kur (Sentry önerilir)
   - Analytics ekle (Google Analytics veya Mixpanel)
   - Kullanıcı aktivitesini takip et

### 6.2 Marketing ve Promosyon

1. **Social Media:**
   - Twitter/X'te duyur
   - LinkedIn'de paylaş
   - Reddit'te r/shopify'da paylaş

2. **Content Marketing:**
   - Blog yazısı yaz
   - YouTube video çek
   - Shopify community'de paylaş

3. **Paid Ads:**
   - Google Ads
   - Facebook Ads
   - Shopify Partners directory'de featured listing

### 6.3 Sürekli İyileştirme

- Kullanıcı feedback'lerini topla
- Yeni özellikler ekle
- Bug'ları düzelt
- Performance'ı optimize et
- App Store listing'i güncelle

---

## 📞 YARDIM VE KAYNAKLAR

### Shopify Dokümantasyonu
- App Store Submission: https://shopify.dev/docs/apps/store/requirements
- App Review Guidelines: https://shopify.dev/docs/apps/store/review

### Shopify Partner Community
- Forum: https://community.shopify.com/c/shopify-apps/bd-p/shopify-apps
- Discord: Shopify Partners Discord server

### Destek
- Shopify Partner Support: partners.shopify.com/support
- Email: partner-support@shopify.com

---

## ✅ HIZLI KONTROL LİSTESİ

### Deployment
- [ ] Railway/Heroku'da deploy edildi
- [ ] Environment variables ayarlandı
- [ ] shopify.app.toml güncellendi
- [ ] Partners Dashboard'da URL'ler güncellendi
- [ ] Production'da test edildi

### App Store Listing
- [ ] App icon hazır (512x512)
- [ ] En az 3 screenshot hazır
- [ ] App açıklaması yazıldı
- [ ] Privacy Policy oluşturuldu ve yayınlandı
- [ ] Terms of Service oluşturuldu ve yayınlandı
- [ ] Support email belirlendi
- [ ] Pricing ayarlandı

### Review Hazırlığı
- [ ] Test store hazır
- [ ] Tüm özellikler test edildi
- [ ] Console'da hata yok
- [ ] Mobile responsive
- [ ] Error handling var

### Gönderme
- [ ] Tüm alanlar dolduruldu
- [ ] "Submit for review" tıklandı
- [ ] Test store bilgileri girildi

---

**🎉 Başarılar! App'inizin App Store'da yayınlanmasını dilerim!**



