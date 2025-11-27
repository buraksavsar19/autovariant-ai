import shopify from "./shopify.js";
import OpenAI from "openai";

/**
 * GPT API ile prompt'u parse edip varyant bilgilerini çıkarır
 * Örnek prompt: "S'den 3XL'e kadar tüm bedenler, kırmızı yeşil mavi sarı mor renkler, 2XL ve sonrası için fiyat +100 lira"
 */
export async function parseVariantPromptWithGPT(prompt, apiKey) {
  if (!apiKey) {
    throw new Error("OpenAI API key bulunamadı. Lütfen OPENAI_API_KEY environment variable'ını ayarlayın.");
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `Sen bir Shopify ürün varyant parser'ısın. Kullanıcının girdiği Türkçe prompt'u analiz edip, JSON formatında döndürmelisin.

Çıkaracağın bilgiler:
- sizes: Beden listesi (örnek: ["S", "M", "L", "XL", "2XL", "3XL"])
- colors: Renk listesi (örnek: ["Kırmızı", "Yeşil", "Mavi"])
- priceRules: Fiyat kuralları (örnek: [{"condition": "2XL ve üzeri", "increase": 100}])
- basePrice: Temel fiyat (eğer belirtilmişse, sayı olarak: 500)
- compareAtPrice: Karşılaştırma fiyatı / İndirimli fiyat öncesi (eğer belirtilmişse, sayı olarak: 600)
- compareAtPriceRules: Karşılaştırma fiyatı kuralları (örnek: [{"condition": "2XL ve üzeri", "value": 700}])
- stockRules: Stok kuralları (örnek: [{"condition": "tümü", "quantity": 10}, {"condition": "2XL", "quantity": 5}])
- defaultStock: Varsayılan stok miktarı (eğer belirtilmişse, sayı olarak: 10)

KRİTİK KURALLAR:
1. Beden aralıkları: "S'den 3XL'e kadar" → ["S", "M", "L", "XL", "2XL", "3XL"]
2. Standart bedenler: XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL
3. Renkler Türkçe olsun ve ilk harfi büyük (kırmızı → Kırmızı, mavi → Mavi, beyaz → Beyaz)
4. ÖNEMLİ: Sadece prompt'ta belirtilen renkleri kullan! "Standart", "Default", "Varsayılan" gibi renkler EKLENMEMELİ!
5. ÖNEMLİ: Eğer prompt'ta hiç renk belirtilmemişse, colors array'ini BOŞ bırak: []
6. ÖNEMLİ: Sadece prompt'ta açıkça belirtilen renkleri ekle. Kendi kafandan renk ekleme!

RENK ÇIKARMA KURALLARI (ÇOK ÖNEMLİ):
- Prompt'ta geçen TÜM renkleri yakala! Hiçbir rengi atlama!
- Renkler virgülle, boşlukla veya "ve" ile ayrılmış olabilir
- "kırmızı beyaz" → ["Kırmızı", "Beyaz"] (iki ayrı renk!)
- "kırmızı, beyaz, mavi" → ["Kırmızı", "Beyaz", "Mavi"]
- "kırmızı ve beyaz" → ["Kırmızı", "Beyaz"]
- "kırmızı beyaz mavi renkler" → ["Kırmızı", "Beyaz", "Mavi"]
- Bilinen renkler: kırmızı, beyaz, siyah, mavi, yeşil, sarı, mor, turuncu, pembe, gri, lacivert, kahverengi, bej, krem, bordo, turkuaz, eflatun, haki, navy, ten rengi

7. FİYAT KURALLARI - ÇOK ÖNEMLİ:
   priceRules bir array olmalı ve her kural bir object olmalı: {"condition": "...", "increase": ...} veya {"condition": "...", "decrease": ...}
   
   Condition formatları (TAM OLARAK BU ŞEKİLDE YAZMALISIN):
   - Tek beden: "2XL", "3XL", "XL", "L" vb.
   - Aralık (ve üzeri): "2XL ve üzeri", "XL ve üzeri", "2XL ve sonrası", "XL ve sonrası"
   - Aralık (ve büyük): "XL'den büyük", "2XL'den büyük"
   - Tek renk: "Kırmızı", "Mavi" vb.
   - Renk aralığı: "Kırmızı renkler" (eğer prompt'ta belirtilmişse)
   
   Artırma/azaltma:
   - "fiyat +100 lira", "100 lira artır", "100 lira fazla" → {"condition": "...", "increase": 100}
   - "fiyat -50 lira", "50 lira azalt", "50 lira indirim" → {"condition": "...", "decrease": 50}
   - "fiyat %10 artır", "%10 artır", "yüzde 10 artır" → {"condition": "...", "increasePercentage": 10}
   - "fiyat %5 azalt", "%5 azalt", "yüzde 5 indirim" → {"condition": "...", "decreasePercentage": 5}
   
   ÖRNEK PROMPTLAR VE ÇIKTILAR:
   - "2XL ve sonrası için fiyat +100 lira" → priceRules: [{"condition": "2XL ve üzeri", "increase": 100}]
   - "XL'den büyük bedenler -50 lira" → priceRules: [{"condition": "XL ve üzeri", "decrease": 50}]
   - "2XL için +100, 3XL için +150" → priceRules: [{"condition": "2XL", "increase": 100}, {"condition": "3XL", "increase": 150}]
   - "Kırmızı renkler için +20 lira" → priceRules: [{"condition": "Kırmızı", "increase": 20}]
   - "2XL ve sonrası bedenler için fiyat 100 lira artır" → priceRules: [{"condition": "2XL ve üzeri", "increase": 100}]
   - "XL ve üzeri bedenler için fiyat %10 artır" → priceRules: [{"condition": "XL ve üzeri", "increasePercentage": 10}]
   - "2XL ve üzeri bedenler için fiyat %15 artır" → priceRules: [{"condition": "2XL ve üzeri", "increasePercentage": 15}]
   - "S ve M bedenler için fiyat %5 azalt" → priceRules: [{"condition": "S", "decreasePercentage": 5}, {"condition": "M", "decreasePercentage": 5}]
   
   ÖNEMLİ: "2XL ve sonrası", "2XL ve üzeri", "2XL'den büyük" gibi ifadeler için MUTLAKA "2XL ve üzeri" formatını kullan!
   ÖNEMLİ: "XL ve sonrası", "XL ve üzeri", "XL'den büyük" gibi ifadeler için MUTLAKA "XL ve üzeri" formatını kullan!

8. TEMEL FİYAT (basePrice):
   - "Fiyat 500 lira" → basePrice: 500
   - "500 lira fiyat" → basePrice: 500
   - "Temel fiyat 500" → basePrice: 500
   - Eğer sadece artırma/azaltma varsa (örn: "+100 lira"), basePrice: null olmalı

8.5. KARŞILAŞTIRMA FİYATI (compareAtPrice) - İNDİRİMLİ ÜRÜNLER İÇİN:
   Karşılaştırma fiyatı = Eski fiyat (üstü çizili gösterilir). Satış fiyatı (basePrice) bundan DÜŞÜK olmalı.
   
   KARŞILAŞTIRMA FİYATI İFADELERİ:
   - "karşılaştırma fiyatı 600" → compareAtPrice: 600
   - "eski fiyat 600" → compareAtPrice: 600
   - "liste fiyatı 600" → compareAtPrice: 600
   - "600 liradan 500 liraya indirimli" → compareAtPrice: 600, basePrice: 500
   - "indirimli fiyat 500, eski fiyat 600" → compareAtPrice: 600, basePrice: 500
   - "%20 indirimli, eski fiyat 600" → compareAtPrice: 600, basePrice: 480 (otomatik hesapla)
   - "karşılaştırma 700 lira" → compareAtPrice: 700
   
   BEDEN/RENK BAZLI KARŞILAŞTIRMA FİYATI:
   - "2XL için karşılaştırma fiyatı 800" → compareAtPriceRules: [{"condition": "2XL", "value": 800}]
   - "Kırmızı için eski fiyat 700" → compareAtPriceRules: [{"condition": "Kırmızı", "value": 700}]
   
   ÖNEMLİ: Eğer karşılaştırma fiyatı belirtilmemişse → compareAtPrice: null, compareAtPriceRules: []

9. STOK KURALLARI (ÇOK ÇOK ÖNEMLİ - DİKKATLİ OKU!):
   defaultStock: Tüm varyantlar için geçerli varsayılan stok miktarı (SAYI olarak, null değil!)
   stockRules: SADECE belirli beden veya renk için özel stok kuralları (nadiren kullanılır)
   
   ⚠️ ALTIN KURAL: Eğer prompt'ta "her", "tüm", "hepsi", "varyant başına", "adet" gibi genel ifadeler varsa → MUTLAKA defaultStock kullan!
   ⚠️ stockRules SADECE belirli bir beden veya renk için FARKLI stok istendiğinde kullanılır!
   
   STOK İFADELERİ → defaultStock (HEPSİ defaultStock OLMALI!):
   - "Her varyant için 10 adet stok" → defaultStock: 10
   - "her varyantın 10 adet olmasını istiyorum" → defaultStock: 10
   - "her varyant 10 adet" → defaultStock: 10
   - "varyantların her biri 10 adet" → defaultStock: 10
   - "varyant başına 10 adet" → defaultStock: 10
   - "tümü için 10 adet stok" → defaultStock: 10
   - "hepsi için 10 adet" → defaultStock: 10
   - "hepsinde 10 adet" → defaultStock: 10
   - "her biri 10 adet" → defaultStock: 10
   - "her birine 10 adet" → defaultStock: 10
   - "10 adet stok" → defaultStock: 10
   - "stok 10" → defaultStock: 10
   - "stok: 10" → defaultStock: 10
   - "10 stok" → defaultStock: 10
   - "10'ar adet" → defaultStock: 10
   - "10'ar adet stok" → defaultStock: 10
   - "tüm varyantlar 10 adet" → defaultStock: 10
   - "hepsine 10 adet" → defaultStock: 10
   - "varyant başına 10" → defaultStock: 10
   - "stoğu 10" → defaultStock: 10
   - "stokları 10" → defaultStock: 10
   
   ÖZEL STOK KURALLARI (stockRules - SADECE BELİRLİ BEDEN/RENK İÇİN!):
   - "2XL için 5 adet, diğerleri için 10 adet" → stockRules: [{"condition": "2XL", "quantity": 5}], defaultStock: 10
   - "Kırmızı için 20 adet, diğerleri 10 adet" → stockRules: [{"condition": "Kırmızı", "quantity": 20}], defaultStock: 10
   - "Sadece mavi için 50 adet" → stockRules: [{"condition": "Mavi", "quantity": 50}], defaultStock: null
   
   ⚠️ ÇOK ÖNEMLİ: 
   - Eğer prompt'ta GENEL bir stok miktarı belirtilmişse (örn: "10 adet", "her varyant 10") → MUTLAKA defaultStock: 10 yaz!
   - stockRules'u BOŞ bırak [] eğer belirli beden/renk için özel kural yoksa!
   - Stok belirtilmemişse defaultStock: null olmalı.
   - YANLIŞ: stockRules'a "tümü" condition'ı eklemek → DOĞRU: defaultStock kullanmak

10. Sadece JSON döndür, açıklama yapma. JSON formatı MUTLAKA geçerli olmalı!

ÖRNEKLER:

Örnek 1 (TEMEL - FİYAT VE STOK):
Prompt: "S'den 3XL'e kadar kırmızı mavi sarı yeşil renklerinde, fiyat 500 lira, her varyant için 10 adet stok"
Response: {"sizes": ["S", "M", "L", "XL", "2XL", "3XL"], "colors": ["Kırmızı", "Mavi", "Sarı", "Yeşil"], "priceRules": [], "basePrice": 500, "stockRules": [], "defaultStock": 10}

Örnek 2 (ÖZEL STOK KURALI):
Prompt: "S'den 3XL'e kadar kırmızı mavi renklerinde, 2XL ve sonrası için fiyat +100 lira, 2XL için 5 adet stok"
Response: {"sizes": ["S", "M", "L", "XL", "2XL", "3XL"], "colors": ["Kırmızı", "Mavi"], "priceRules": [{"condition": "2XL ve üzeri", "increase": 100}], "basePrice": null, "stockRules": [{"condition": "2XL", "quantity": 5}], "defaultStock": null}

Örnek 3 (FİYAT KURALLARI):
Prompt: "S M L XL 2XL bedenler, kırmızı yeşil mavi renkler, XL'den büyük bedenler için -50 lira, kırmızı için +20 lira"
Response: {"sizes": ["S", "M", "L", "XL", "2XL"], "colors": ["Kırmızı", "Yeşil", "Mavi"], "priceRules": [{"condition": "XL ve üzeri", "decrease": 50}, {"condition": "Kırmızı", "increase": 20}], "basePrice": null, "stockRules": [], "defaultStock": null}

Örnek 4 (TEMEL FİYAT + ARTIŞ):
Prompt: "S'den 3XL'e kadar, kırmızı mavi renkler, fiyat 300 lira, 2XL ve sonrası için +100 lira ekstra"
Response: {"sizes": ["S", "M", "L", "XL", "2XL", "3XL"], "colors": ["Kırmızı", "Mavi"], "priceRules": [{"condition": "2XL ve üzeri", "increase": 100}], "basePrice": 300, "stockRules": [], "defaultStock": null}

Örnek 5 (BOŞLUKLA AYRILAN RENKLER):
Prompt: "S'den 3XL'e kadar tüm bedenler, kırmızı beyaz renkler, fiyat 500 lira"
Response: {"sizes": ["S", "M", "L", "XL", "2XL", "3XL"], "colors": ["Kırmızı", "Beyaz"], "priceRules": [], "basePrice": 500, "stockRules": [], "defaultStock": null}

Örnek 6 (ÜÇ RENK BOŞLUKLA):
Prompt: "S'den 3XL'e kadar bedenler, siyah beyaz gri renkler, fiyat 450 lira"
Response: {"sizes": ["S", "M", "L", "XL", "2XL", "3XL"], "colors": ["Siyah", "Beyaz", "Gri"], "priceRules": [], "basePrice": 450, "stockRules": [], "defaultStock": null}

Örnek 7 (VİRGÜLLE AYRILAN):
Prompt: "M, L, XL bedenler, beyaz, lacivert, bordo renkler"
Response: {"sizes": ["M", "L", "XL"], "colors": ["Beyaz", "Lacivert", "Bordo"], "priceRules": [], "basePrice": null, "stockRules": [], "defaultStock": null}

Örnek 8 (STOK - "TÜMÜ İÇİN" İFADESİ - ÇOK ÖNEMLİ!):
Prompt: "S'den 3XL'e kadar, kırmızı yeşil mavi renkler, tümü için 10 adet stok"
Response: {"sizes": ["S", "M", "L", "XL", "2XL", "3XL"], "colors": ["Kırmızı", "Yeşil", "Mavi"], "priceRules": [], "basePrice": null, "stockRules": [], "defaultStock": 10}

Örnek 9 (STOK - KISA İFADE):
Prompt: "S M L XL bedenler, siyah beyaz renkler, 10 stok"
Response: {"sizes": ["S", "M", "L", "XL"], "colors": ["Siyah", "Beyaz"], "priceRules": [], "basePrice": null, "stockRules": [], "defaultStock": 10}

Örnek 10 (STOK - "HEPSİ" İFADESİ):
Prompt: "M L XL 2XL bedenler, mavi kırmızı, fiyat 600, hepsi için 15 adet"
Response: {"sizes": ["M", "L", "XL", "2XL"], "colors": ["Mavi", "Kırmızı"], "priceRules": [], "basePrice": 600, "stockRules": [], "defaultStock": 15}

Örnek 11 (STOK - "ADET" SONRA):
Prompt: "S'den 2XL'e kadar, yeşil sarı turuncu, 20 adet stok"
Response: {"sizes": ["S", "M", "L", "XL", "2XL"], "colors": ["Yeşil", "Sarı", "Turuncu"], "priceRules": [], "basePrice": null, "stockRules": [], "defaultStock": 20}

Örnek 12 (HER ŞEY BİRLİKTE):
Prompt: "S M L XL 2XL 3XL bedenler, siyah beyaz gri lacivert renkler, fiyat 750 lira, 2XL ve üzeri için +150 lira, tümü için 25 adet"
Response: {"sizes": ["S", "M", "L", "XL", "2XL", "3XL"], "colors": ["Siyah", "Beyaz", "Gri", "Lacivert"], "priceRules": [{"condition": "2XL ve üzeri", "increase": 150}], "basePrice": 750, "stockRules": [], "defaultStock": 25}

Örnek 13 (STOK - "HER VARYANT" İFADESİ - ÇOK ÖNEMLİ!):
Prompt: "S M L XL bedenler, kırmızı mavi yeşil renkler, her varyantın 10 adet olmasını istiyorum"
Response: {"sizes": ["S", "M", "L", "XL"], "colors": ["Kırmızı", "Mavi", "Yeşil"], "priceRules": [], "basePrice": null, "stockRules": [], "defaultStock": 10}

Örnek 14 (STOK - KISA VE NET):
Prompt: "S M L XL, kırmızı mavi, her varyant 10 adet"
Response: {"sizes": ["S", "M", "L", "XL"], "colors": ["Kırmızı", "Mavi"], "priceRules": [], "basePrice": null, "stockRules": [], "defaultStock": 10}

Örnek 15 (STOK - VARYANT BAŞINA):
Prompt: "S'den XL'e kadar, siyah beyaz gri, varyant başına 15 adet stok"
Response: {"sizes": ["S", "M", "L", "XL"], "colors": ["Siyah", "Beyaz", "Gri"], "priceRules": [], "basePrice": null, "stockRules": [], "defaultStock": 15}

Örnek 16 (STOK - FİYAT VE STOK BİRLİKTE):
Prompt: "M L XL 2XL, mavi yeşil sarı, fiyat 500, her biri 20 adet"
Response: {"sizes": ["M", "L", "XL", "2XL"], "colors": ["Mavi", "Yeşil", "Sarı"], "priceRules": [], "basePrice": 500, "stockRules": [], "defaultStock": 20}

YANLIŞ ÖRNEK (Standart eklenmemeli):
{"sizes": ["S", "M", "L"], "colors": ["Standart", "Kırmızı"], ...} ❌

YANLIŞ ÖRNEK (Renk atlanmamalı):
Prompt: "kırmızı beyaz mavi"
Yanlış: {"colors": ["Kırmızı", "Mavi"]} ❌ (Beyaz atlandı!)
Doğru: {"colors": ["Kırmızı", "Beyaz", "Mavi"]} ✓

YANLIŞ ÖRNEK (Stok yanlış yerde):
Prompt: "her varyant 10 adet"
Yanlış: {"stockRules": [{"condition": "tümü", "quantity": 10}], "defaultStock": null} ❌
Doğru: {"stockRules": [], "defaultStock": 10} ✓`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content);
    
    // Debug: GPT'nin döndürdüğü sonucu logla
    console.log("=== GPT PARSE RESULT ===");
    console.log("Original prompt:", prompt);
    console.log("GPT Result:", JSON.stringify(result, null, 2));
    console.log("PriceRules:", JSON.stringify(result.priceRules, null, 2));
    console.log("=== END GPT PARSE ===");
    
    // Format kontrolü ve düzeltme
    return {
      sizes: Array.isArray(result.sizes) ? result.sizes : [],
      colors: Array.isArray(result.colors) ? result.colors : [],
      priceRules: Array.isArray(result.priceRules) ? result.priceRules : [],
      basePrice: result.basePrice ? parseFloat(result.basePrice) : null,
      compareAtPrice: result.compareAtPrice ? parseFloat(result.compareAtPrice) : null,
      compareAtPriceRules: Array.isArray(result.compareAtPriceRules) ? result.compareAtPriceRules : [],
      stockRules: Array.isArray(result.stockRules) ? result.stockRules : [],
      defaultStock: result.defaultStock ? parseInt(result.defaultStock) : null,
    };
  } catch (error) {
    console.error("GPT API hatası:", error);
    throw new Error("Prompt analiz edilemedi: " + error.message);
  }
}

/**
 * Eski parse fonksiyonu (fallback için)
 * Prompt'u parse edip varyant bilgilerini çıkarır
 * Örnek prompt: "S'den 3XL'e kadar tüm bedenler, kırmızı yeşil mavi sarı mor renkler, 2XL ve sonrası için fiyat +100 lira"
 */
export function parseVariantPrompt(prompt) {
  const result = {
    sizes: [],
    colors: [],
    priceRules: [], // {condition: "2XL ve üzeri", increase: 100}
    basePrice: null,
    stockRules: [], // {condition: "2XL", quantity: 5}
    defaultStock: null,
  };

  const lowerPrompt = prompt.toLowerCase();

  // Bedenleri bul (S, M, L, XL, 2XL, 3XL, vb.)
  const sizePatterns = [
    /(\d*xl|xs|s|m|l)/gi,
    /(\d+[\s-]*xl|xs|s|m|l)/gi,
    /beden[ler]*[:\s]*([^,]+)/i,
  ];

  const sizeKeywords = {
    xs: "XS",
    s: "S",
    m: "M",
    l: "L",
    xl: "XL",
    "2xl": "2XL",
    "3xl": "3XL",
    "4xl": "4XL",
    "5xl": "5XL",
  };

  // "S'den 3XL'e kadar" gibi ifadeleri yakala
  const sizeRangeMatch = lowerPrompt.match(/([a-z0-9]+)'?den?\s+([a-z0-9]+)'?e?\s+kadar/i);
  if (sizeRangeMatch) {
    const startSize = sizeRangeMatch[1].toUpperCase().replace(/\s/g, "");
    const endSize = sizeRangeMatch[2].toUpperCase().replace(/\s/g, "");
    result.sizes = generateSizeRange(startSize, endSize);
  } else {
    // Tek tek bedenleri bul
    for (const pattern of sizePatterns) {
      const matches = prompt.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          const normalized = match.trim().toUpperCase().replace(/\s/g, "");
          if (sizeKeywords[normalized.toLowerCase()]) {
            if (!result.sizes.includes(sizeKeywords[normalized.toLowerCase()])) {
              result.sizes.push(sizeKeywords[normalized.toLowerCase()]);
            }
          } else if (!result.sizes.includes(normalized)) {
            result.sizes.push(normalized);
          }
        });
        break;
      }
    }

    // Eğer hiç beden bulunamadıysa, "tüm bedenler" kontrolü
    if (result.sizes.length === 0 && lowerPrompt.includes("tüm bedenler")) {
      result.sizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
    }
  }

  // Renkleri bul
  const colorKeywords = [
    "kırmızı", "kirmizi", "red",
    "yeşil", "yesil", "green",
    "mavi", "blue",
    "sarı", "sari", "yellow",
    "mor", "purple",
    "siyah", "black",
    "beyaz", "white",
    "gri", "grey", "gray",
    "turuncu", "orange",
    "pembe", "pink",
    "kahverengi", "brown",
    "lacivert", "navy",
  ];

  const colorMap = {
    "kırmızı": "Kırmızı", "kirmizi": "Kırmızı", "red": "Kırmızı",
    "yeşil": "Yeşil", "yesil": "Yeşil", "green": "Yeşil",
    "mavi": "Mavi", "blue": "Mavi",
    "sarı": "Sarı", "sari": "Sarı", "yellow": "Sarı",
    "mor": "Mor", "purple": "Mor",
    "siyah": "Siyah", "black": "Siyah",
    "beyaz": "Beyaz", "white": "Beyaz",
    "gri": "Gri", "grey": "Gri", "gray": "Gri",
    "turuncu": "Turuncu", "orange": "Turuncu",
    "pembe": "Pembe", "pink": "Pembe",
    "kahverengi": "Kahverengi", "brown": "Kahverengi",
    "lacivert": "Lacivert", "navy": "Lacivert",
  };

  colorKeywords.forEach((keyword) => {
    if (lowerPrompt.includes(keyword)) {
      const colorName = colorMap[keyword];
      if (colorName && !result.colors.includes(colorName)) {
        result.colors.push(colorName);
      }
    }
  });

  // Fiyat kurallarını bul
  // "2XL ve sonrası için fiyat +100 lira" gibi
  const priceRulePatterns = [
    /(\d+xl|xl ve üzeri|xl ve sonrası)[\s\w]*fiyat[\s\w]*(\+|\+?)(\d+)[\s]*(lira|tl|₺)/i,
    /(\d+xl|xl ve üzeri|xl ve sonrası)[\s\w]*(\+|\+?)(\d+)[\s]*(lira|tl|₺)/i,
    /fiyat[\s\w]*(\+|\+?)(\d+)[\s]*(lira|tl|₺)[\s\w]*(\d+xl|xl ve üzeri)/i,
  ];

  for (const pattern of priceRulePatterns) {
    const match = lowerPrompt.match(pattern);
    if (match) {
      const condition = match[1] || match[4] || "";
      const amount = parseInt(match[3] || match[2]);
      if (amount && condition) {
        result.priceRules.push({
          condition: condition.trim(),
          increase: amount,
        });
      }
    }
  }

  // Temel fiyat bul (opsiyonel)
  const basePriceMatch = lowerPrompt.match(/(?:fiyat|price)[\s:]*(\d+)[\s]*(lira|tl|₺)?/i);
  if (basePriceMatch) {
    result.basePrice = parseFloat(basePriceMatch[1]);
  }

  // Stok kurallarını bul
  // "Her varyant için 10 adet stok" veya "Stok 10" gibi
  const defaultStockMatch = lowerPrompt.match(/(?:her\s+varyant\s+için|stok|adet)[\s:]*(\d+)[\s]*(?:adet|stok)?/i);
  if (defaultStockMatch) {
    result.defaultStock = parseInt(defaultStockMatch[1]);
  }

  // Belirli bedenler için stok kuralları
  // "2XL için 5 adet" gibi
  const specificStockMatch = lowerPrompt.match(/(\d+xl|xl)[\s]+için[\s]+(\d+)[\s]*(?:adet|stok)/i);
  if (specificStockMatch) {
    result.stockRules.push({
      condition: specificStockMatch[1].toUpperCase(),
      quantity: parseInt(specificStockMatch[2]),
    });
  }

  return result;
}

/**
 * Beden aralığı oluşturur (örn: S'den 3XL'e kadar)
 */
function generateSizeRange(start, end) {
  const allSizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
  const startIndex = allSizes.indexOf(start.toUpperCase());
  const endIndex = allSizes.indexOf(end.toUpperCase());

  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    return allSizes; // Hata durumunda tüm bedenleri döndür
  }

  return allSizes.slice(startIndex, endIndex + 1);
}

/**
 * Fiyat kuralı condition'ını parse edip hangi varyantın etkileneceğini döndürür
 * @param {string} condition - Fiyat kuralı condition'ı (örn: "2XL ve üzeri", "Kırmızı", "XL ve sonrası")
 * @param {string} currentSize - Kontrol edilecek beden
 * @param {string} currentColor - Kontrol edilecek renk (opsiyonel)
 * @returns {boolean} - Bu varyant için kural uygulanmalı mı?
 */
function shouldApplyPriceRule(condition, currentSize, currentColor = null) {
  const allSizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
  const conditionLower = condition.toLowerCase();
  const currentSizeUpper = currentSize ? currentSize.toUpperCase() : "";
  const currentColorLower = currentColor ? currentColor.toLowerCase() : "";
  
  // Renk kontrolü (eğer condition bir renk ise)
  const commonColors = {
    "kırmızı": "kırmızı", "kirmizi": "kırmızı", "red": "kırmızı",
    "yeşil": "yeşil", "yesil": "yeşil", "green": "yeşil",
    "mavi": "mavi", "blue": "mavi",
    "sarı": "sarı", "sari": "sarı", "yellow": "sarı",
    "mor": "mor", "purple": "mor",
    "siyah": "siyah", "black": "siyah",
    "beyaz": "beyaz", "white": "beyaz",
    "gri": "gri", "grey": "gri", "gray": "gri",
    "turuncu": "turuncu", "orange": "turuncu",
    "pembe": "pembe", "pink": "pembe",
  };
  
  // Önce renk kontrolü yap
  for (const [key, normalizedColor] of Object.entries(commonColors)) {
    if (conditionLower.includes(key) && !conditionLower.match(/\d+xl|xs|s|m|l|beden|size/i)) {
      // Condition'da renk var ama beden yok, bu bir renk kuralı
      if (currentColorLower && currentColorLower.includes(normalizedColor)) {
        return true;
      }
    }
  }
  
  // Eğer condition direkt bir renk adı ise (örn: "Kırmızı")
  if (currentColor && commonColors[conditionLower]) {
    if (currentColorLower.includes(commonColors[conditionLower])) {
      return true;
    }
  }
  
  // Beden kontrolü (eğer condition bir beden ise)
  if (!currentSizeUpper) {
    return false; // Beden yoksa beden kuralları uygulanamaz
  }
  
  // Tek bir beden kontrolü (örn: "2XL", "3XL")
  if (conditionLower.match(/^(\d+xl|xs|s|m|l)$/)) {
    const targetSize = conditionLower.toUpperCase().replace(/\s/g, "");
    return currentSizeUpper === targetSize;
  }
  
  // "ve üzeri", "ve sonrası", "den büyük" gibi ifadeler
  if (conditionLower.includes("ve üzeri") || 
      conditionLower.includes("ve sonrası") || 
      conditionLower.includes("den büyük") ||
      conditionLower.includes("'den büyük")) {
    
    // Condition'dan beden bilgisini çıkar
    const sizeMatches = conditionLower.match(/(\d+xl|xs|s|m|l|xl)/);
    if (sizeMatches) {
      const startSize = sizeMatches[1].toUpperCase().replace(/\s/g, "");
      const startIndex = allSizes.indexOf(startSize);
      
      if (startIndex === -1) {
        // Beden bulunamadı, "XL ve üzeri" gibi genel ifadeleri kontrol et
        if (conditionLower.includes("xl ve üzeri") || conditionLower.includes("xl ve sonrası")) {
          return ["XL", "2XL", "3XL", "4XL", "5XL"].includes(currentSizeUpper);
        }
        return false;
      }
      
      // StartSize ve sonrası tüm bedenler için uygula
      const currentIndex = allSizes.indexOf(currentSizeUpper);
      return currentIndex >= startIndex;
    }
    
    // "XL ve üzeri" gibi genel ifadeler (specific beden belirtilmemiş)
    if (conditionLower.includes("xl ve üzeri") || conditionLower.includes("xl ve sonrası")) {
      return ["XL", "2XL", "3XL", "4XL", "5XL"].includes(currentSizeUpper);
    }
  }
  
  // Condition'da direkt beden adı geçiyorsa (örn: "2xl için", "3xl bedenler")
  for (const size of allSizes) {
    if (conditionLower.includes(size.toLowerCase()) && currentSizeUpper === size) {
      return true;
    }
  }
  
  return false;
}

/**
 * Varyantları Shopify'e ekler
 */
export async function createVariants(session, productId, parsedVariant) {
  const client = new shopify.api.clients.Graphql({ session });

  // Shop'un location'ını al (stok için locationId gerekiyor)
  // Eğer location erişim izni yoksa, stok bilgisini göndermeyeceğiz
  let defaultLocationId = null;
  let defaultLocationName = null;
  try {
    // ID ve name alıyoruz (ProductSetInput için name gerekli)
    const locationsQuery = `
      query getLocations {
        locations(first: 1) {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `;

    const locationsData = await client.request(locationsQuery);
    const locationNode = locationsData.data.locations.edges[0]?.node;
    defaultLocationId = locationNode?.id || null;
    defaultLocationName = locationNode?.name || null;
    console.log("Location ID alındı:", defaultLocationId);
    console.log("Location Name alındı:", defaultLocationName);
    
    if (!defaultLocationId) {
      console.warn("Location bulunamadı! Stok bilgisi gönderilmeyecek.");
    }
  } catch (error) {
    console.warn("Location erişim izni yok veya location bulunamadı, stok bilgisi gönderilmeyecek:", error.message);
    console.warn("NOT: Lütfen shopify.app.toml dosyasına 'read_locations' scope'unu ekleyin ve uygulamayı yeniden başlatın.");
    console.warn("Error details:", error);
    // Location erişim izni yoksa, stok bilgisini göndermeyeceğiz
    defaultLocationId = null;
    defaultLocationName = null;
  }

  // Önce mevcut ürünün bilgilerini al
  const productQuery = `
    query getProduct($id: ID!) {
      product(id: $id) {
        id
        title
        variants(first: 1) {
          edges {
            node {
              price
            }
          }
        }
        options {
          id
          name
          values
          position
        }
      }
    }
  `;

  const productData = await client.request(productQuery, {
    variables: { id: productId },
  });

  const product = productData.data.product;
  
  // Temel fiyat: önce parsedVariant'tan al, yoksa ürünün mevcut fiyatından al
  let basePrice = "0.00";
  if (parsedVariant.basePrice !== null && parsedVariant.basePrice !== undefined) {
    basePrice = parsedVariant.basePrice.toString();
  } else {
    basePrice = product.variants.edges[0]?.node.price || "0.00";
  }

  // Debug: Parsed variant bilgilerini logla
  console.log("=== PARSED VARIANT DEBUG ===");
  console.log("defaultStock:", parsedVariant.defaultStock);
  console.log("stockRules:", JSON.stringify(parsedVariant.stockRules, null, 2));
  console.log("editableVariants:", parsedVariant.editableVariants ? "Var" : "Yok");
  console.log("=== END DEBUG ===");

  // Varyant kombinasyonlarını oluştur
  const combinations = [];
  
  // Eğer düzenlenmiş varyantlar varsa, onları direkt kullan
  if (parsedVariant.editableVariants && Array.isArray(parsedVariant.editableVariants) && parsedVariant.editableVariants.length > 0) {
    parsedVariant.editableVariants.forEach(variant => {
      combinations.push({
        size: variant.size,
        color: variant.color,
        price: parseFloat(variant.price).toFixed(2),
        compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice).toFixed(2) : null,
        inventoryQuantity: Math.max(0, parseInt(variant.stock) || 0),
      });
    });
  } else {
    // Eski yöntem: Kombinasyonları oluştur
    for (const size of parsedVariant.sizes) {
      for (const color of parsedVariant.colors) {
        let variantPrice = parseFloat(basePrice);
        let variantStock = parsedVariant.defaultStock || 0;

        // Fiyat kurallarını uygula
        for (const rule of parsedVariant.priceRules || []) {
          const condition = rule.condition || "";
          
          // Bu kural bu varyant için uygulanmalı mı? (hem beden hem renk kontrolü)
          if (!shouldApplyPriceRule(condition, size, color)) {
            continue; // Bu varyant için kural uygulanmıyor, diğerine geç
          }
          
          // Increase (artırma) - sabit miktar
          if (rule.increase) {
            variantPrice += rule.increase;
          }
          
          // Decrease (azaltma) - sabit miktar
          if (rule.decrease) {
            variantPrice -= rule.decrease;
          }
          
          // IncreasePercentage (artırma) - yüzdelik
          if (rule.increasePercentage) {
            const percentage = parseFloat(rule.increasePercentage) || 0;
            variantPrice += (variantPrice * percentage) / 100;
          }
          
          // DecreasePercentage (azaltma) - yüzdelik
          if (rule.decreasePercentage) {
            const percentage = parseFloat(rule.decreasePercentage) || 0;
            variantPrice -= (variantPrice * percentage) / 100;
          }
        }

        // Stok kurallarını uygula
        let generalStock = null;
        let specificStock = null;
        for (const rule of parsedVariant.stockRules || []) {
          const condition = (rule.condition || "").toLowerCase().trim();
          const quantity = rule.quantity !== undefined ? parseInt(rule.quantity, 10) : null;
          if (quantity === null || Number.isNaN(quantity)) {
            continue;
          }

          const isGeneral =
            condition === "tümü" ||
            condition === "hepsi" ||
            condition === "her biri" ||
            condition === "genel" ||
            condition === "default";

          const matchesSize = size && condition.includes(size.toLowerCase());
          const matchesColor = color && condition.includes(color.toLowerCase());

          if (matchesSize || matchesColor) {
            specificStock = quantity;
          } else if (isGeneral) {
            generalStock = quantity;
          }
        }

        if (specificStock !== null) {
          variantStock = specificStock;
        } else if (generalStock !== null) {
          variantStock = generalStock;
        }

        // Fiyat negatif olamaz
        if (variantPrice < 0) variantPrice = 0;

        const finalStock = Math.max(0, variantStock);
        if (finalStock > 0) {
          console.log(`Kombinasyon stok bilgisi: ${size}/${color} = ${finalStock} adet`);
        }

        // Karşılaştırma fiyatı varsa ekle
        let variantCompareAtPrice = null;
        // Not: Bu branch zaten kullanılmıyor (editableVariants kullanılıyor), 
        // ama yine de ekleyelim tutarlılık için

        combinations.push({
          size,
          color,
          price: variantPrice.toFixed(2),
          compareAtPrice: variantCompareAtPrice,
          inventoryQuantity: finalStock, // Negatif olamaz
        });
      }
    }
  }

  // Mevcut options'ları kontrol et
  // Eğer ürünün options'ı yoksa veya boşsa, direkt productSet kullan
  const existingOptions = product.options || [];
  const existingOptionNames = existingOptions.map((opt) => opt.name.toLowerCase());
  const needsSizeOption = !existingOptionNames.includes("beden") && !existingOptionNames.includes("size");
  const needsColorOption = !existingOptionNames.includes("renk") && !existingOptionNames.includes("color");

  // Debug: Mevcut option'ları logla
  console.log("Mevcut options:", existingOptions.map(opt => opt.name));
  console.log("Beden option gerekli mi:", needsSizeOption);
  console.log("Renk option gerekli mi:", needsColorOption);

  // Shopify limit: Maksimum 3 option olabilir
  const SHOPIFY_MAX_OPTIONS = 3;
  const newOptionsNeeded = (needsSizeOption ? 1 : 0) + (needsColorOption ? 1 : 0);
  const totalOptionsAfterAdd = existingOptions.length + newOptionsNeeded;

  // Eğer limit aşılacaksa hata ver
  if (totalOptionsAfterAdd > SHOPIFY_MAX_OPTIONS) {
    throw new Error(
      `Ürününüzde zaten ${existingOptions.length} option var. ` +
      `Shopify'da maksimum ${SHOPIFY_MAX_OPTIONS} option olabilir. ` +
      `Beden ve Renk eklemek için ${newOptionsNeeded} yeni option gerekiyor, bu toplamı ${totalOptionsAfterAdd} yapar. ` +
      `Lütfen mevcut option'lardan bazılarını silin veya ürününüze manuel olarak Beden/Renk option'larını ekleyin.`
    );
  }

  // Eğer Beden ve Renk option'ları ZATEN VARSA, direkt productVariantsBulkCreate kullan
  // Sadece options yoksa VEYA eksikse productSet kullan
  if (!needsSizeOption && !needsColorOption && existingOptions.length > 0) {
    // Beden ve Renk zaten var, direkt variants ekle (productVariantsBulkCreate)
    // Bu durumda options'ı güncellemeye gerek yok
    console.log("Beden ve Renk option'ları zaten var, direkt variants ekleniyor...");
  } else if (existingOptions.length === 0 || needsSizeOption || needsColorOption) {
    // Mevcut options'ları hazırla - productSet formatında
    const productOptions = [];
    
    // Önce mevcut options'ları ekle (eğer varsa) - MEVCUT DEĞERLERİ KORU
    // NOT: Title option'ını hariç tutuyoruz (gereksiz, sadece Beden ve Renk kullanıyoruz)
    if (existingOptions && existingOptions.length > 0) {
      existingOptions.forEach((opt) => {
        // Title option'ını atla
        if (opt.name.toLowerCase() === "title") {
          return;
        }
        
        // Mevcut option değerlerini al
        const existingValues = Array.isArray(opt.values) ? opt.values : (opt.values ? [opt.values] : []);
        
        // Eğer Beden option'ı ise, mevcut değerleri koru VE yeni değerleri ekle
        if (opt.name.toLowerCase() === "beden" || opt.name.toLowerCase() === "size") {
          const allSizeValues = new Set([...existingValues, ...parsedVariant.sizes]);
          productOptions.push({
            name: opt.name, // Mevcut ismi kullan
            values: Array.from(allSizeValues).map(val => ({ name: val })),
          });
        } 
        // Eğer Renk option'ı ise, mevcut değerleri koru VE yeni değerleri ekle
        else if (opt.name.toLowerCase() === "renk" || opt.name.toLowerCase() === "color") {
          const allColorValues = new Set([...existingValues, ...parsedVariant.colors]);
          productOptions.push({
            name: opt.name, // Mevcut ismi kullan
            values: Array.from(allColorValues).map(val => ({ name: val })),
          });
        }
        // Diğer option'lar için mevcut değerleri koru (Title hariç)
        else {
          productOptions.push({
            name: opt.name,
            values: existingValues.map(val => ({ name: val })),
          });
        }
      });
    }

    // Yeni options'ları ekle - ama önce mevcut option'larda var mı kontrol et
    const hasSizeInExisting = productOptions.find(opt => 
      opt.name.toLowerCase() === "beden" || opt.name.toLowerCase() === "size"
    );
    const hasColorInExisting = productOptions.find(opt => 
      opt.name.toLowerCase() === "renk" || opt.name.toLowerCase() === "color"
    );

    // Eğer Beden option'ı yoksa ekle
    if (!hasSizeInExisting && needsSizeOption && parsedVariant.sizes && parsedVariant.sizes.length > 0) {
      // Limit kontrolü
      if (productOptions.length >= 3) {
        throw new Error(
          `Ürününüzde zaten ${productOptions.length} option var. ` +
          `Shopify'da maksimum 3 option olabilir. Beden ekleyemiyoruz. ` +
          `Lütfen mevcut option'lardan birini silin.`
        );
      }
      productOptions.push({
        name: "Beden",
        values: parsedVariant.sizes.map(size => ({ name: size })),
      });
    }
    
    // Eğer Renk option'ı yoksa ekle
    if (!hasColorInExisting && needsColorOption && parsedVariant.colors && parsedVariant.colors.length > 0) {
      // Limit kontrolü
      if (productOptions.length >= 3) {
        throw new Error(
          `Ürününüzde zaten ${productOptions.length} option var. ` +
          `Shopify'da maksimum 3 option olabilir. Renk ekleyemiyoruz. ` +
          `Lütfen mevcut option'lardan birini silin.`
        );
      }
      productOptions.push({
        name: "Renk",
        values: parsedVariant.colors.map(color => ({ name: color })),
      });
    }

    console.log("Toplam options:", productOptions.length, productOptions.map(opt => opt.name));

    // Variants'ları hazırla - productSet formatında
    // ProductSetInput içinde variants formatı: { optionValues: [{ optionName, name }], price }
    // ÖNEMLİ: Her variant için productOptions içinde tanımlanan TÜM options'ların değerini göndermemiz gerekiyor
    const productVariants = combinations.map(combo => {
      const optionValues = [];
      
      // productOptions içinde tanımlanan her option için değer ekle
      productOptions.forEach(productOpt => {
        let valueToUse = null;
        const optNameLower = productOpt.name.toLowerCase();
        
        // Title option'ını atla (gereksiz)
        if (optNameLower === "title") {
          return;
        }
        
        // Beden option'ı için
        if (optNameLower === "beden" || optNameLower === "size") {
          valueToUse = combo.size;
        } 
        // Renk option'ı için
        else if (optNameLower === "renk" || optNameLower === "color") {
          valueToUse = combo.color;
        } 
        // Diğer option'lar için - mevcut değerlerden birini kullan (Title hariç)
        else {
          // Mevcut option değerlerinden birini kullan (ilk değer)
          if (productOpt.values && productOpt.values.length > 0) {
            valueToUse = productOpt.values[0].name || productOpt.values[0];
          }
        }
        
        // Değer varsa ekle
        if (valueToUse) {
          optionValues.push({
            optionName: productOpt.name,
            name: valueToUse,
          });
        }
      });
      
      // NOT: ProductSet mutation'ında da title field'ı kullanılamıyor gibi görünüyor
      // Shopify varyant title'larını otomatik olarak oluşturuyor
      const hasStock = combo.inventoryQuantity && defaultLocationId;
      if (hasStock) {
        console.log(`Stok bilgisi gönderiliyor: ${combo.size}/${combo.color} - ${combo.inventoryQuantity} adet (Location: ${defaultLocationId})`);
      } else if (combo.inventoryQuantity && !defaultLocationId) {
        console.warn(`Stok bilgisi ATLANDI: ${combo.size}/${combo.color} - ${combo.inventoryQuantity} adet (Location ID yok)`);
      }
      
      return {
        price: combo.price,
        compareAtPrice: combo.compareAtPrice || null,
        optionValues: optionValues,
        inventoryQuantities: hasStock ? [
          {
            name: "available", // Quantity type: "available" veya "on_hand"
            quantity: combo.inventoryQuantity,
            locationId: defaultLocationId,
          }
        ] : [],
      };
    });

    // productSet mutation ile hem options hem variants'ı birlikte ekle
    const productSetMutation = `
      mutation productSet($input: ProductSetInput!) {
        productSet(input: $input) {
          product {
            id
            options {
              id
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

    try {
      const setResult = await client.request(productSetMutation, {
        variables: {
          input: {
            id: productId,
            productOptions: productOptions,
            variants: productVariants,
          },
        },
      });

      // Hata kontrolü
      if (setResult.data.productSet.userErrors.length > 0) {
        throw new Error(
          setResult.data.productSet.userErrors.map((e) => e.message).join(", ")
        );
      }

      // Ürün bilgilerini yeniden al
      const updatedProductData = await client.request(productQuery, {
        variables: { id: productId },
      });
      product.options = updatedProductData.data.product.options;

      // Eğer productSet ile variants da eklendiyse, direkt dön
      return {
        success: true,
        variantsCreated: productVariants.length,
        variants: [], // productSet variants döndürmez, sadece başarıyı kontrol ediyoruz
      };
    } catch (error) {
      console.error("Options ve variants ekleme hatası:", error);
      throw new Error(
        "Ürününüze options ve varyantlar eklenemedi: " + error.message
      );
    }
  }

  // Options mapping: Mevcut options'ları index'e göre map et
  // NOT: Title option'ını hariç tutuyoruz (gereksiz, sadece Beden ve Renk kullanıyoruz)
  const optionIndexMap = {};
  product.options.forEach((opt, index) => {
    // Title option'ını atla
    if (opt.name.toLowerCase() !== "title") {
      optionIndexMap[opt.name.toLowerCase()] = index;
    }
  });

  // Size ve color option index'lerini bul
  const sizeOptionIndex = optionIndexMap["beden"] !== undefined 
    ? optionIndexMap["beden"] 
    : optionIndexMap["size"] !== undefined 
      ? optionIndexMap["size"] 
      : null;
  
  const colorOptionIndex = optionIndexMap["renk"] !== undefined 
    ? optionIndexMap["renk"] 
    : optionIndexMap["color"] !== undefined 
      ? optionIndexMap["color"] 
      : null;

  // Options varsa index kullanacağız, yoksa direkt değerleri göndereceğiz (Shopify otomatik oluşturacak)

  // Varyantları oluştur - options array'ini doğru sırayla oluştur
  let variants;
  
  if (sizeOptionIndex !== null && colorOptionIndex !== null) {
    // Options var, normal şekilde oluştur
    variants = combinations.map((combo) => {
      // Options array'ini doğru index sırasına göre oluştur
      // NOT: Title option'ını atlıyoruz, sadece Beden ve Renk kullanıyoruz
      const optionsArray = [];
      
      // Sadece Beden ve Renk'i ekle (Title'ı atla)
      if (sizeOptionIndex !== null) {
        optionsArray.push(combo.size);
      }
      if (colorOptionIndex !== null) {
        optionsArray.push(combo.color);
      }

      return {
        price: combo.price,
        compareAtPrice: combo.compareAtPrice || null,
        options: optionsArray, // Sadece Beden ve Renk
        inventoryPolicy: "CONTINUE", // Stok yönetimi
        inventoryQuantity: combo.inventoryQuantity || 0,
      };
    });
  } else {
    // Options yok, direkt option değerlerini gönder (Shopify otomatik oluşturacak)
    variants = combinations.map((combo) => {
      return {
        price: combo.price,
        compareAtPrice: combo.compareAtPrice || null,
        options: [combo.size, combo.color], // Options yoksa direkt değerleri gönder
        inventoryPolicy: "CONTINUE",
        inventoryQuantity: combo.inventoryQuantity || 0,
      };
    });
  }

  // Batch olarak varyantları ekle (Shopify limiti: 250 varyant)
  const createVariantsMutation = `
    mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        productVariants {
          id
          title
          price
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    // Shopify API'si için formatı düzenle
    // ProductVariantsBulkInput'da "optionValues" kullanılmalı
    // Format: [{ optionName: "Beden", name: "S" }, { optionName: "Renk", name: "Kırmızı" }]
    const shopifyVariants = variants.map((variant) => {
      // Options array'ini optionValues formatına çevir
      const optionValues = [];
      
      if (sizeOptionIndex !== null && colorOptionIndex !== null && Array.isArray(variant.options)) {
        // Options varsa, optionValues formatına çevir
        // VariantOptionValueInput formatı: { optionName: "...", name: "..." }
        variant.options.forEach((value, index) => {
          if (value && product.options[index]) {
            // Title option'ını atla
            if (product.options[index].name.toLowerCase() !== "title") {
              optionValues.push({
                optionName: product.options[index].name,
                name: value, // "value" değil "name" kullanılmalı
              });
            }
          }
        });
      } else if (Array.isArray(variant.options)) {
        // Options array'i direkt [size, color] formatında
        if (variant.options.length >= 1) {
          optionValues.push({ optionName: "Beden", name: variant.options[0] });
        }
        if (variant.options.length >= 2) {
          optionValues.push({ optionName: "Renk", name: variant.options[1] });
        }
      }

      // NOT: ProductVariantsBulkInput'da title field'ı desteklenmiyor
      // Shopify otomatik olarak varyant title'ını "Ürün Adı / Option1 / Option2" formatında oluşturuyor
      // Title'ı değiştirmek için varyantlar oluşturulduktan sonra ayrı mutation gerekli (şimdilik yok)
      // Kombinasyondan inventoryQuantity'yi bul
      const combo = combinations.find(c => {
        const sizeMatch = optionValues.find(ov => ov.optionName === "Beden" || ov.optionName === "Size");
        const colorMatch = optionValues.find(ov => ov.optionName === "Renk" || ov.optionName === "Color");
        return sizeMatch?.name === c.size && colorMatch?.name === c.color;
      });

      const hasStock = combo?.inventoryQuantity && defaultLocationId;
      if (hasStock) {
        console.log(`Stok bilgisi gönderiliyor (bulkCreate): ${combo.size}/${combo.color} - ${combo.inventoryQuantity} adet (Location: ${defaultLocationId})`);
      } else if (combo?.inventoryQuantity && !defaultLocationId) {
        console.warn(`Stok bilgisi ATLANDI (bulkCreate): ${combo.size}/${combo.color} - ${combo.inventoryQuantity} adet (Location ID yok)`);
      }

      return {
        price: variant.price,
        compareAtPrice: combo?.compareAtPrice || variant.compareAtPrice || null,
        optionValues: optionValues,
        inventoryPolicy: variant.inventoryPolicy,
        inventoryQuantities: hasStock ? [
          {
            availableQuantity: combo.inventoryQuantity,
            locationId: defaultLocationId,
          }
        ] : [],
      };
    });

    const result = await client.request(createVariantsMutation, {
      variables: {
        productId: productId,
        variants: shopifyVariants,
      },
    });

    if (result.data.productVariantsBulkCreate.userErrors.length > 0) {
      const errors = result.data.productVariantsBulkCreate.userErrors;
      const errorMessages = errors.map((e) => e.message).join(", ");
      
      // Eğer "Option does not exist" hatası varsa, productSet ile tekrar deneyelim
      const errorLower = errorMessages.toLowerCase();
      if (errorLower.includes("option does not exist") || 
          errorLower.includes("option") || 
          errorLower.includes("not exist")) {
        
        console.warn("productVariantsBulkCreate başarısız, productSet ile tekrar deneniyor...");
        
        // productSet ile tekrar dene - bu durumda options'ları da oluşturur
        // Mevcut options'ları hazırla
        const productOptions = [];
        
        // Mevcut options'ları ekle (eğer varsa) - MEVCUT DEĞERLERİ KORU VE YENİLERİ EKLE
        // NOT: Title option'ını hariç tutuyoruz (gereksiz, sadece Beden ve Renk kullanıyoruz)
        if (existingOptions && existingOptions.length > 0) {
          existingOptions.forEach((opt) => {
            const optNameLower = opt.name.toLowerCase();
            
            // Title option'ını atla
            if (optNameLower === "title") {
              return;
            }
            
            // Mevcut option değerlerini al
            const existingValues = Array.isArray(opt.values) ? opt.values : (opt.values ? [opt.values] : []);
            
            // Beden option'ı ise, mevcut değerleri koru VE yeni değerleri ekle
            if (optNameLower === "beden" || optNameLower === "size") {
              const allSizeValues = new Set([...existingValues.map(v => String(v)), ...parsedVariant.sizes]);
              productOptions.push({
                name: opt.name, // Mevcut ismi kullan
                values: Array.from(allSizeValues).map(val => ({ name: String(val) })),
              });
            } 
            // Renk option'ı ise, mevcut değerleri koru VE yeni değerleri ekle
            else if (optNameLower === "renk" || optNameLower === "color") {
              const allColorValues = new Set([...existingValues.map(v => String(v)), ...parsedVariant.colors]);
              productOptions.push({
                name: opt.name, // Mevcut ismi kullan
                values: Array.from(allColorValues).map(val => ({ name: String(val) })),
              });
            }
            // Diğer option'lar için mevcut değerleri koru (Title hariç)
            else {
              productOptions.push({
                name: opt.name,
                values: existingValues.map(val => ({ name: String(val) })),
              });
            }
          });
        }

        // Yeni options'ları ekle - ama önce mevcut option'larda var mı kontrol et
        const SHOPIFY_MAX_OPTIONS = 3;
        const currentOptionCount = productOptions.length;
        const remainingSlots = SHOPIFY_MAX_OPTIONS - currentOptionCount;
        
        console.log("Fallback - Mevcut options:", existingOptions.map(opt => opt.name));
        console.log("Fallback - ProductOptions şu an:", productOptions.map(opt => opt.name));
        console.log("Fallback - Kalan slot:", remainingSlots);
        
        // Fallback scope'unda da needsSizeOption ve needsColorOption değişkenlerini kontrol et
        const fallbackNeedsSizeOption = !existingOptionNames.includes("beden") && !existingOptionNames.includes("size");
        const fallbackNeedsColorOption = !existingOptionNames.includes("renk") && !existingOptionNames.includes("color");
        
        const hasSizeInFallback = productOptions.find(opt => 
          opt.name.toLowerCase() === "beden" || opt.name.toLowerCase() === "size"
        );
        const hasColorInFallback = productOptions.find(opt => 
          opt.name.toLowerCase() === "renk" || opt.name.toLowerCase() === "color"
        );

        if (!hasSizeInFallback && fallbackNeedsSizeOption && remainingSlots > 0 && parsedVariant.sizes && parsedVariant.sizes.length > 0) {
          if (productOptions.length >= SHOPIFY_MAX_OPTIONS) {
            throw new Error(
              `Ürününüzde zaten ${productOptions.length} option var. ` +
              `Shopify'da maksimum ${SHOPIFY_MAX_OPTIONS} option olabilir. Beden ekleyemiyoruz. ` +
              `Lütfen mevcut option'lardan birini silin.`
            );
          }
          productOptions.push({
            name: "Beden",
            values: parsedVariant.sizes.map(size => ({ name: size })),
          });
        }
        
        const newRemainingSlots = SHOPIFY_MAX_OPTIONS - productOptions.length;
        if (!hasColorInFallback && fallbackNeedsColorOption && newRemainingSlots > 0 && parsedVariant.colors && parsedVariant.colors.length > 0) {
          productOptions.push({
            name: "Renk",
            values: parsedVariant.colors.map(color => ({ name: color })),
          });
        }

        console.log("Fallback - Toplam options:", productOptions.length, productOptions.map(opt => opt.name));

        // Eğer hala option eklenemediyse hata ver
        if (fallbackNeedsSizeOption && !productOptions.find(opt => opt.name.toLowerCase() === "beden" || opt.name.toLowerCase() === "size") ||
            fallbackNeedsColorOption && !productOptions.find(opt => opt.name.toLowerCase() === "renk" || opt.name.toLowerCase() === "color")) {
          throw new Error(
            `Ürününüzde zaten ${existingOptions.length} option var. ` +
            `Shopify'da maksimum ${SHOPIFY_MAX_OPTIONS} option olabilir. ` +
            `Beden ve Renk eklemek için yeterli alan yok. ` +
            `Lütfen mevcut option'lardan bazılarını silin veya ürününüze manuel olarak Beden/Renk option'larını ekleyin.`
          );
        }

        // Variants'ları hazırla
        const productVariants = combinations.map(combo => {
          const optionValues = [];
          
          productOptions.forEach(productOpt => {
            let valueToUse = null;
            const optNameLower = productOpt.name.toLowerCase();
            
            // Title option'ını atla (gereksiz)
            if (optNameLower === "title") {
              return;
            }
            
            // Beden option'ı için
            if (optNameLower === "beden" || optNameLower === "size") {
              valueToUse = combo.size;
            } 
            // Renk option'ı için
            else if (optNameLower === "renk" || optNameLower === "color") {
              valueToUse = combo.color;
            } 
            // Diğer option'lar için - mevcut değerlerden birini kullan (Title hariç)
            else {
              // Mevcut option değerlerinden birini kullan (ilk değer)
              if (productOpt.values && productOpt.values.length > 0) {
                const firstValue = productOpt.values[0];
                valueToUse = firstValue.name || firstValue || "";
              }
            }
            
            // Değer varsa ekle
            if (valueToUse) {
              optionValues.push({
                optionName: productOpt.name,
                name: String(valueToUse),
              });
            }
          });
          
          const hasStock = combo.inventoryQuantity && defaultLocationId;
          if (hasStock) {
            console.log(`Stok bilgisi gönderiliyor (productSet fallback): ${combo.size}/${combo.color} - ${combo.inventoryQuantity} adet (Location: ${defaultLocationId})`);
          } else if (combo.inventoryQuantity && !defaultLocationId) {
            console.warn(`Stok bilgisi ATLANDI (productSet fallback): ${combo.size}/${combo.color} - ${combo.inventoryQuantity} adet (Location ID yok)`);
          }
          
          return {
            price: combo.price,
            compareAtPrice: combo.compareAtPrice || null,
            optionValues: optionValues,
            inventoryQuantities: hasStock ? [
              {
                name: "available", // Quantity type: "available" veya "on_hand"
                quantity: combo.inventoryQuantity,
                locationId: defaultLocationId,
              }
            ] : [],
          };
        });

        // productSet mutation ile hem options hem variants'ı birlikte ekle
        const productSetMutation = `
          mutation productSet($input: ProductSetInput!) {
            productSet(input: $input) {
              product {
                id
                options {
                  id
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

        const setResult = await client.request(productSetMutation, {
          variables: {
            input: {
              id: productId,
              productOptions: productOptions,
              variants: productVariants,
            },
          },
        });

        if (setResult.data.productSet.userErrors.length > 0) {
          throw new Error(
            setResult.data.productSet.userErrors.map((e) => e.message).join(", ")
          );
        }

        return {
          success: true,
          variantsCreated: productVariants.length,
          variants: [],
        };
      }
      
      throw new Error(errorMessages);
    }

    return {
      success: true,
      variantsCreated: result.data.productVariantsBulkCreate.productVariants.length,
      variants: result.data.productVariantsBulkCreate.productVariants,
    };
  } catch (error) {
    console.error("Varyant oluşturma hatası:", error);
    throw error;
  }
}


