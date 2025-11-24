# 🎯 Shopify App Store Yayınlama - SÜPER DETAYLI REHBER
## (Her Tıklama, Her Ekran Açıklamalı)

Bu rehber, hiçbir şey bilmeyen biri için yazılmıştır. Her adımı, her tıklamayı, her ekranı göreceksiniz.

---

## 📍 BÖLÜM 1: SHOPIFY PARTNERS HESABI OLUŞTURMA

### Adım 1.1: Tarayıcıyı Aç

1. **Chrome, Safari veya Firefox** tarayıcınızı açın
2. Adres çubuğuna şunu yazın: `partners.shopify.com`
3. **Enter** tuşuna basın

### Adım 1.2: Sign Up Sayfasına Git

1. Açılan sayfada sağ üst köşede **"Sign up"** butonunu görürsünüz
2. **"Sign up"** butonuna **TIKLAYIN**

### Adım 1.3: Hesap Bilgilerini Gir

Açılan formda şunları doldurun:

1. **Email adresi** kutusuna email'inizi yazın
   - Örnek: `burak@example.com`
   
2. **Password** kutusuna şifrenizi yazın
   - En az 8 karakter olmalı
   - Büyük harf, küçük harf, rakam içermeli
   
3. **Confirm password** kutusuna aynı şifreyi tekrar yazın

4. **I agree to Shopify's Terms of Service** yazısının yanındaki **kutucuğa TIKLAYIN** (✓ işareti çıkacak)

5. **"Create account"** butonuna **TIKLAYIN**

### Adım 1.4: Email Doğrulama

1. Email kutunuzu açın (Gmail, Outlook, vs.)
2. Shopify'dan gelen email'i bulun
3. Email'i açın
4. İçinde **"Verify email"** veya **"Confirm email"** butonu olacak
5. O butona **TIKLAYIN**
6. Tarayıcıda yeni bir sekme açılacak ve "Email verified" yazısı göreceksiniz

### Adım 1.5: Şirket Bilgilerini Doldur

Email doğrulandıktan sonra bir form açılacak:

1. **Company name** kutusuna şirket adınızı yazın
   - Örnek: "Autovariant AI" veya kendi adınız
   
2. **Country** dropdown'ına **TIKLAYIN**
   - Açılan listeden ülkenizi seçin (Türkiye için "Turkey")
   
3. **Phone number** kutusuna telefon numaranızı yazın
   - Örnek: +90 555 123 4567

4. **"Continue"** butonuna **TIKLAYIN**

### Adım 1.6: Partners Dashboard'a Giriş

Artık Partners Dashboard'a giriş yaptınız! Şimdi app oluşturma zamanı.

---

## 📍 BÖLÜM 2: APP OLUŞTURMA (PARTNERS DASHBOARD'DA)

### Adım 2.1: Apps Sekmesine Git

1. Ekranın sol tarafında bir menü göreceksiniz
2. Menüde **"Apps"** yazısına **TIKLAYIN**
   - Eğer "Apps" görünmüyorsa, üst menüde "Apps" sekmesine tıklayın

### Adım 2.2: Create App Butonunu Bul

1. Apps sayfasında sağ üst köşede **"Create app"** butonu göreceksiniz
2. **"Create app"** butonuna **TIKLAYIN**

### Adım 2.3: App Adını Gir

Açılan popup'ta:

1. **"App name"** kutusuna şunu yazın: `Autovariant AI`
2. **"Create app"** butonuna **TIKLAYIN**

### Adım 2.4: App Detaylarını Gör

App oluşturuldu! Şimdi app detay sayfasındasınız. Bu sayfada şunları göreceksiniz:

- **Client ID** (API Key) - Bunu not alın!
- **Client secret** (API Secret) - Bunu da not alın!

**ÖNEMLİ:** Bu bilgileri bir yere kaydedin (Notepad, Notes, vs.)

### Adım 2.5: App Setup Sekmesine Git

1. Sayfanın üstünde sekmeler göreceksiniz:
   - App setup
   - App Store listing
   - Analytics
   - v.s.
   
2. **"App setup"** sekmesine **TIKLAYIN**

### Adım 2.6: App URL'lerini Gör (Şimdilik Değiştirmeyin)

App setup sayfasında şunları göreceksiniz:

- **App URL:** `https://example.com` (şimdilik böyle kalsın)
- **Allowed redirection URL(s):** `https://example.com/api/auth` (şimdilik böyle kalsın)

**NOT:** Bu URL'leri production deployment yaptıktan sonra değiştireceğiz. Şimdilik böyle bırakın.

---

## 📍 BÖLÜM 3: PRODUCTION DEPLOYMENT (RAILWAY.APP İLE)

### Adım 3.1: Railway.app'e Git

1. Yeni bir sekme açın (Ctrl+T veya Cmd+T)
2. Adres çubuğuna yazın: `railway.app`
3. **Enter** tuşuna basın

### Adım 3.2: Railway'de Hesap Oluştur

1. Railway ana sayfasında sağ üst köşede **"Login"** butonunu görürsünüz
2. **"Login"** butonuna **TIKLAYIN**
3. Açılan sayfada **"Sign up with Email"** veya **"Sign up"** butonunu görürsünüz
4. Email ve şifre ile hesap oluşturun

### Adım 3.4: Railway Dashboard'a Giriş

Artık Railway dashboard'undasınız!

### Adım 3.5: Yeni Proje Oluştur

1. Railway dashboard'unda **"New Project"** butonunu görürsünüz
2. **"New Project"** butonuna **TIKLAYIN**
3. Açılan menüde **"Empty Project"** veya **"Deploy from local directory"** seçeneğini seçin

### Adım 3.6: Railway CLI ile Deploy

Railway'e projenizi yüklemek için Railway CLI kullanacağız:

1. Terminal'i açın
2. Railway CLI'yi yükleyin: `npm i -g @railway/cli`
3. Railway'e giriş yapın: `railway login`
4. Proje klasörüne gidin: `cd /Users/buraksavsar/Desktop/autovariant-ai`
5. Railway projesi oluşturun: `railway init`
6. Projeyi deploy edin: `railway up`

### Adım 3.7: Service Oluştur

1. Railway dashboard'unda **"Add Service"** butonuna **TIKLAYIN**
2. Açılan menüden **"Empty Service"** seçeneğine **TIKLAYIN**
3. Service adını girin: `autovariant-ai`
4. **"Create"** butonuna **TIKLAYIN**

### Adım 3.8: Environment Variables Ekle

1. Railway dashboard'unda service'inize **TIKLAYIN**
2. Üst menüde **"Variables"** sekmesine **TIKLAYIN**
3. **"New Variable"** butonuna **TIKLAYIN**

Şimdi sırayla şu değişkenleri ekleyin:

**Değişken 1:**
- **Name:** `SHOPIFY_API_KEY`
- **Value:** Partners Dashboard'dan kopyaladığınız Client ID
- **"Add"** butonuna **TIKLAYIN**

**Değişken 2:**
- **Name:** `SHOPIFY_API_SECRET`
- **Value:** Partners Dashboard'dan kopyaladığınız Client secret
- **"Add"** butonuna **TIKLAYIN**

**Değişken 3:**
- **Name:** `SCOPES`
- **Value:** `write_products`
- **"Add"** butonuna **TIKLAYIN**

**Değişken 4:**
- **Name:** `OPENAI_API_KEY`
- **Value:** OpenAI API key'iniz (eğer varsa)
- **"Add"** butonuna **TIKLAYIN**

**Değişken 5:**
- **Name:** `NODE_ENV`
- **Value:** `production`
- **"Add"** butonuna **TIKLAYIN**

### Adım 3.9: Domain Oluştur

1. Railway dashboard'unda service'inize **TIKLAYIN**
2. Üst menüde **"Settings"** sekmesine **TIKLAYIN**
3. Aşağı kaydırın, **"Generate Domain"** butonunu bulun
4. **"Generate Domain"** butonuna **TIKLAYIN**
5. Bir domain oluşturulacak, örnek: `autovariant-ai-production.up.railway.app`
6. Bu domain'i **KOPYALAYIN** (Ctrl+C veya Cmd+C)
7. Bir yere **NOT EDİN** (Notepad, Notes, vs.)

### Adım 3.10: Deploy'i Bekle

1. Railway otomatik olarak deploy etmeye başlayacak
2. **"Deployments"** sekmesine **TIKLAYIN**
3. Deploy işleminin tamamlanmasını bekleyin (2-5 dakika)
4. Yeşil "Success" yazısını görünce deploy tamamlanmış demektir

---

## 📍 BÖLÜM 4: SHOPIFY PARTNERS DASHBOARD'DA URL'LERİ GÜNCELLEME

### Adım 4.1: Partners Dashboard'a Dön

1. Shopify Partners Dashboard sekmesine geri dönün
2. **"Apps"** sekmesine **TIKLAYIN**
3. **"Autovariant AI"** app'ine **TIKLAYIN**

### Adım 4.2: App Setup Sekmesine Git

1. **"App setup"** sekmesine **TIKLAYIN**

### Adım 4.3: App URL'i Güncelle

1. **"App URL"** kutusunu bulun
2. İçindeki `https://example.com` yazısını **SİLİN**
3. Railway'den kopyaladığınız domain'i **YAPIŞTIRIN**
   - Örnek: `https://autovariant-ai-production.up.railway.app`
4. **"Save"** butonuna **TIKLAYIN**

### Adım 4.4: Redirect URL'i Güncelle

1. **"Allowed redirection URL(s)"** kutusunu bulun
2. İçindeki `https://example.com/api/auth` yazısını **SİLİN**
3. Railway domain'inizi yazın + `/api/auth` ekleyin
   - Örnek: `https://autovariant-ai-production.up.railway.app/api/auth`
4. **"Save"** butonuna **TIKLAYIN**

---

## 📍 BÖLÜM 5: PRODUCTION'DA TEST ETME

### Adım 5.1: Test Store Oluştur

1. Partners Dashboard'da sol menüden **"Stores"** sekmesine **TIKLAYIN**
2. **"Add store"** butonuna **TIKLAYIN**
3. **"Development store"** seçeneğine **TIKLAYIN**
4. **"Create store"** butonuna **TIKLAYIN**
5. Store adını girin: `Autovariant AI Test Store`
6. **"Create store"** butonuna **TIKLAYIN**

### Adım 5.2: App'i Test Store'a Yükle

1. Test store'unuzun admin paneline gidin
2. Sol menüden **"Apps"** sekmesine **TIKLAYIN**
3. **"App and sales channel settings"** linkine **TIKLAYIN**
4. **"Develop apps"** sekmesine **TIKLAYIN**
5. **"Autovariant AI"** app'ini bulun
6. **"Install"** butonuna **TIKLAYIN**
7. İzinleri onaylayın

### Adım 5.3: App'i Test Et

1. App açıldığında tüm özellikleri test edin:
   - Ürün seçimi
   - Varyant oluşturma
   - Görsel yükleme
   - Template sistemi

---

## 📍 BÖLÜM 6: APP STORE LISTING HAZIRLIĞI

### Adım 6.1: App İkonu Hazırlama

**Seçenek 1: Canva ile (Ücretsiz)**

1. `canva.com` adresine gidin
2. **"Create a design"** butonuna **TIKLAYIN**
3. **"Custom size"** seçeneğine **TIKLAYIN**
4. Width: `512`, Height: `512` yazın
5. **"Create new design"** butonuna **TIKLAYIN**
6. Logo tasarımınızı yapın
7. Sağ üstte **"Download"** butonuna **TIKLAYIN**
8. Format: **"PNG"** seçin
9. **"Download"** butonuna **TIKLAYIN**

**Seçenek 2: Fiverr'da Tasarımcı Bul**

1. `fiverr.com` adresine gidin
2. Arama kutusuna "logo design" yazın
3. Bir tasarımcı seçin ($5-20 arası)
4. Sipariş verin
5. 512x512 PNG formatında teslim alın

### Adım 6.2: Screenshot'lar Hazırlama

1. Chrome'da app'inizi açın
2. **F12** tuşuna basın (Developer Tools açılır)
3. **Ctrl+Shift+M** (Mac: Cmd+Shift+M) tuşlarına basın (Device Toolbar açılır)
4. Üstteki boyut ayarlarından **"Responsive"** seçin
5. Width: `1200`, Height: `800` yazın
6. App'inizi ekranda görüntüleyin
7. **Windows:** `Win+Shift+S` tuşlarına basın (Snipping Tool)
   **Mac:** `Cmd+Shift+4` tuşlarına basın
8. Ekranı seçin ve kaydedin

**En az 5 screenshot hazırlayın:**
- Screenshot 1: Ana ekran (varyant oluşturma)
- Screenshot 2: AI prompt ekranı
- Screenshot 3: Görsel eşleştirme
- Screenshot 4: Template sistemi
- Screenshot 5: Başarı ekranı

### Adım 6.3: Privacy Policy ve Terms'i Yayınlama

**Seçenek 1: Railway Static Files (Ücretsiz)**

1. Railway dashboard'unda static files hosting ekleyin
2. `PRIVACY.md` dosyasını açın
3. Sağ üstte **"Edit"** butonuna **TIKLAYIN**
4. Email adresinizi güncelleyin (`[YOUR-EMAIL@EXAMPLE.COM]` yerine)
5. **"Commit changes"** butonuna **TIKLAYIN**
6. Aynı şeyi `TERMS.md` için de yapın

**Seçenek 2: Kendi Domain'inizde**

1. Web hosting'inizde bir sayfa oluşturun
2. `PRIVACY.md` içeriğini kopyalayıp yapıştırın
3. URL'i not edin (örn: `https://yourdomain.com/privacy`)

---

## 📍 BÖLÜM 7: APP STORE LISTING DOLDURMA

### Adım 7.1: App Store Listing Sekmesine Git

1. Partners Dashboard'da app'inize gidin
2. Üst menüde **"App Store listing"** sekmesine **TIKLAYIN**

### Adım 7.2: App Name

1. **"App name"** kutusunu bulun
2. İçine yazın: `Autovariant AI`
3. **"Save"** butonuna **TIKLAYIN**

### Adım 7.3: Short Description

1. **"Short description"** kutusunu bulun
2. İçine yazın (500 karakter max):
```
Create product variants in seconds using AI and natural language. Perfect for fashion and apparel stores. Save hours of manual work.
```
3. **"Save"** butonuna **TIKLAYIN**

### Adım 7.4: Long Description

1. **"Long description"** kutusunu bulun
2. İçine detaylı açıklama yazın (4000 karakter max)
3. **"Save"** butonuna **TIKLAYIN**

### Adım 7.5: App Icon Yükleme

1. **"App icon"** bölümünü bulun
2. **"Upload"** veya **"Choose file"** butonuna **TIKLAYIN**
3. Hazırladığınız 512x512 PNG icon'u seçin
4. **"Open"** butonuna **TIKLAYIN**
5. Yükleme tamamlanana kadar bekleyin

### Adım 7.6: Screenshots Yükleme

1. **"Screenshots"** bölümünü bulun
2. **"Add screenshot"** butonuna **TIKLAYIN**
3. İlk screenshot'unuzu seçin
4. **"Open"** butonuna **TIKLAYIN**
5. En az 3 screenshot yükleyin (5 önerilir)
6. Her screenshot için tekrarlayın

### Adım 7.7: Categories Seç

1. **"Categories"** bölümünü bulun
2. **"Primary category"** dropdown'ına **TIKLAYIN**
3. **"Product management"** seçeneğini seçin
4. (Opsiyonel) **"Secondary category"** seçin

### Adım 7.8: Support Email

1. **"Support email"** kutusunu bulun
2. Email adresinizi yazın
3. **"Save"** butonuna **TIKLAYIN**

### Adım 7.9: Privacy Policy URL

1. **"Privacy Policy URL"** kutusunu bulun
2. Privacy Policy'nizin URL'ini yazın
   - Railway Static: `https://your-app.railway.app/PRIVACY.md`
   - Kendi domain: `https://yourdomain.com/privacy`
3. **"Save"** butonuna **TIKLAYIN**

### Adım 7.10: Terms of Service URL

1. **"Terms of Service URL"** kutusunu bulun
2. Terms'inizin URL'ini yazın
3. **"Save"** butonuna **TIKLAYIN**

---

## 📍 BÖLÜM 8: PRICING AYARLAMA

### Adım 8.1: Pricing Sekmesine Git

1. Partners Dashboard'da app'inize gidin
2. Üst menüde **"Pricing"** sekmesine **TIKLAYIN**

### Adım 8.2: Pricing Model Seç

**Seçenek 1: Ücretsiz (Başlangıç için önerilir)**

1. **"Free"** seçeneğine **TIKLAYIN**
2. **"Save"** butonuna **TIKLAYIN**

**Seçenek 2: Ücretli Plan**

1. **"Recurring charge"** seçeneğine **TIKLAYIN**
2. **"Add plan"** butonuna **TIKLAYIN**
3. Plan adı: `Pro Plan`
4. Fiyat: `9.99`
5. Periyot: `Monthly`
6. **"Save"** butonuna **TIKLAYIN**

---

## 📍 BÖLÜM 9: REVIEW GÖNDERME

### Adım 9.1: Pre-Submission Checklist

Göndermeden önce kontrol edin:

- [ ] Production'da deploy edildi ✅
- [ ] App URL'leri güncellendi ✅
- [ ] Test store'da test edildi ✅
- [ ] App icon yüklendi ✅
- [ ] En az 3 screenshot yüklendi ✅
- [ ] App açıklaması yazıldı ✅
- [ ] Privacy Policy URL eklendi ✅
- [ ] Terms of Service URL eklendi ✅
- [ ] Support email eklendi ✅

### Adım 9.2: Test Store Bilgilerini Hazırla

1. Test store'unuzun URL'ini not edin
   - Örnek: `autovariant-ai-test.myshopify.com`
2. Admin email ve şifresini not edin

### Adım 9.3: Submit for Review

1. Partners Dashboard'da app'inize gidin
2. **"App Store listing"** sekmesine **TIKLAYIN**
3. Sayfanın en altına kaydırın
4. **"Submit for review"** butonunu bulun
5. **"Submit for review"** butonuna **TIKLAYIN**

### Adım 9.4: Test Store Bilgilerini Gir

1. Açılan formda test store bilgilerini girin:
   - **Store URL:** Test store'unuzun URL'i
   - **Admin email:** Test store admin email'i
   - **Admin password:** Test store admin şifresi
2. **"Submit"** butonuna **TIKLAYIN**

### Adım 9.5: Review Sürecini Bekle

1. **"Submitted for review"** yazısını göreceksiniz
2. Shopify review yapacak (5-10 iş günü)
3. Email'inizi kontrol edin (feedback gelecek)

---

## 📍 BÖLÜM 10: REVIEW SONRASI

### Senaryo 1: Approved (Onaylandı) ✅

1. Email'de "Your app has been approved" yazısını göreceksiniz
2. Partners Dashboard'da app'iniz "Published" durumunda olacak
3. App Store'da arayarak bulabilirsiniz!

### Senaryo 2: Changes Requested (Düzeltme İsteniyor) ⚠️

1. Email'de feedback'i okuyun
2. İstenen değişiklikleri yapın
3. Production'a deploy edin
4. Partners Dashboard'da **"Resubmit for review"** butonuna **TIKLAYIN**

### Senaryo 3: Rejected (Reddedildi) ❌

1. Email'deki feedback'i okuyun
2. Sorunları düzeltin
3. Tekrar submit edin

---

## 🎉 TEBRİKLER!

App'iniz App Store'da yayınlandı! Artık kullanıcılar app'inizi bulup yükleyebilir.

---

## ❓ SIK SORULAN SORULAR

**S: Railway deploy ederken hata alıyorum?**
C: Environment variables'ların doğru girildiğinden emin olun. Railway logs'a bakın.

**S: App Store listing'de bir alanı doldurmayı unuttum?**
C: Sorun değil, daha sonra düzenleyebilirsiniz. Ama review göndermeden önce tüm alanları doldurun.

**S: Screenshot'lar yüklenmiyor?**
C: Boyutların 1200x800 olduğundan emin olun. PNG veya JPG formatında olmalı.

**S: Review ne kadar sürer?**
C: Genellikle 5-10 iş günü. Bazen daha hızlı olabilir.

**S: App'i yayınladıktan sonra değişiklik yapabilir miyim?**
C: Evet! Her zaman güncelleyebilirsiniz. Ama büyük değişiklikler için tekrar review gerekebilir.

---

**Herhangi bir adımda takılırsanız, bana sorun! 🚀**


