/**
 * AutoVariant AI - UI Texts
 * 
 * Bu dosya tüm UI metinlerini merkezi olarak tutar.
 * i18n geçişinde bu dosya t() fonksiyonu ile değiştirilecek.
 * 
 * KULLANIM:
 * import { texts } from '../utils/texts';
 * <Text>{texts.steps.selectProduct}</Text>
 */

export const texts = {
  // App genel
  app: {
    title: "Otomatik Varyant Oluşturucu",
    loading: "Yükleniyor...",
  },

  // Adımlar
  steps: {
    selectProduct: "Ürün Seç",
    preview: "Önizleme",
    images: "Görseller",
    finish: "Bitir",
  },

  // Adım açıklamaları
  stepHelp: {
    step0: "Bir ürün seçin ve varyant kurallarınızı doğal dil ile yazın. Örnek: 'S'den 3XL'e kadar tüm bedenler, kırmızı yeşil mavi renkler, temel fiyat 200 lira'",
    step1: "Oluşturulacak varyantları önizleyin. Gerekirse düzenleyin ve 'Varyantları Oluştur' butonuna tıklayın.",
    step2: "Ürün fotoğraflarını yükleyin ve renklere otomatik eşleştirin. Her renk için uygun fotoğrafları seçin.",
    step3: "Tüm işlemler tamamlandı! Ürününüze gidip sonuçları kontrol edebilirsiniz.",
  },

  // Butonlar
  buttons: {
    preview: "Önizleme",
    createVariants: "Varyantları Oluştur",
    createVariantsMulti: "{count} Ürüne Varyantları Oluştur",
    uploadImages: "📤 Ürün Fotoğraflarını Ekle",
    uploading: "Yükleniyor...",
    analyzeColors: "🎨 Renkleri AI ile Eşleştir",
    analyzing: "Analiz ediliyor...",
    saveTemplate: "📝 Şablon Olarak Kaydet",
    useTemplate: "Kullan",
    delete: "Sil",
    cancel: "İptal",
    save: "Kaydet",
    refresh: "Yenile",
    refreshProducts: "Ürünleri Yenile",
    clearAll: "Tümünü temizle",
    viewInShopify: "Shopify'da Görüntüle",
    newVariant: "Yeni Varyant Oluştur",
    addProductInShopify: "Shopify'da Ürün Ekle",
    applyToAll: "Tümüne Uygula",
    selectAll: "Tümünü Seç",
    deselectAll: "Seçimi Kaldır",
    startOnboarding: "Başlayalım! 🚀",
  },

  // Etiketler
  labels: {
    product: "Ürün",
    products: "Ürünler",
    prompt: "Varyant Kuralları",
    promptPlaceholder: "Örnek: S'den 3XL'e kadar tüm bedenler, kırmızı yeşil mavi renkler, fiyat 500 lira, her varyant için 10 adet stok",
    size: "Beden",
    color: "Renk",
    price: "Fiyat",
    stock: "Stok",
    variant: "Varyant",
    variants: "Varyantlar",
    templates: "Şablonlar",
    history: "Geçmiş",
    templateName: "Şablon Adı",
    templateNamePlaceholder: "Şablon adı girin...",
    examples: "Örnekler",
    multiSelect: "Çoklu ürün seçimi",
    notSpecified: "Belirtilmemiş",
    standard: "Standart",
    photos: "fotoğraf",
    ready: "hazır",
  },

  // Hata mesajları
  errors: {
    emptyPrompt: "Lütfen bir prompt girin",
    noSizeOrColor: "Prompt'tan beden veya renk bilgisi çıkarılamadı",
    previewFailed: "Önizleme oluşturulamadı",
    connectionError: "Bağlantı hatası: Sunucuya erişilemiyor. Lütfen internet bağlantınızı kontrol edin.",
    productsLoadFailed: "Ürünler yüklenemedi",
    colorAnalysisFailed: "Renk analizi yapılamadı",
    uploadFailed: "Görseller yüklenirken bir hata oluştu",
    noImagesUploaded: "Lütfen önce görsel yükleyin",
    noPreview: "Lütfen önce varyant önizlemesi oluşturun",
    noProductImages: "Lütfen önce bu ürün için görsel yükleyin",
    templateNameRequired: "Lütfen template için bir isim girin",
    previewRequired: "Lütfen önce önizleme oluşturun",
    genericError: "Bir hata oluştu",
  },

  // Hata başlıkları
  errorTitles: {
    connection: "🌐 Bağlantı Sorunu",
    rateLimit: "⏱️ İşlem Limiti",
    service: "⚙️ Servis Hatası",
    product: "📦 Ürün Hatası",
    prompt: "✏️ Prompt Hatası",
  },

  // Başarı mesajları
  success: {
    templateSaved: '"{name}" template\'i başarıyla kaydedildi! 🎉',
    templateLoaded: '"{name}" template\'i yüklendi! Önizleme oluşturuluyor...',
    colorAnalysisComplete: "Renk analizi tamamlandı! Lütfen eşleştirmeleri kontrol edin.",
    variantsCreated: "{count} varyant başarıyla oluşturuldu! 🎉",
    variantsCreatedMulti: "{count} varyant {productCount} ürüne başarıyla eklendi! 🎉",
    imagesUploaded: "{productName} için {count} görsel başarıyla Shopify'a yüklendi ve varyantlara atandı! 🎉",
    flowComplete: "Akış tamamlandı 🎉",
    title: "🎉 Başarılı!",
  },

  // Bilgi mesajları
  info: {
    noProducts: "Mağazanızda ürün bulunamadı",
    noProductsHelp: "Varyant oluşturmak için önce Shopify'da en az bir ürün eklemeniz gerekiyor.",
    previewHint: "💡 Varyantları oluşturmak için önce \"Önizleme\" butonuna tıklayın.",
    dragDropHint: "Sıralama önemli!",
    dragDropInfo: "Fotoğrafları sürükleyerek sıralayabilirsiniz. 1. sıradaki fotoğraf Shopify'da ana ürün görseli olarak görünecek.",
    colorMatchComplete: "✅ Fotoğraflar renklere başarıyla eşleştirildi!",
    colorMatchInfo: "Eşleştirmeler tamamlandı. Şimdi fotoğrafları Shopify'a yükleyebilirsiniz.",
    uploadToShopifyInfo: "Eşleştirmeler tamamlandı. Shopify'a yüklemek için yukarıdaki butona tıklayın.",
    timeSaved: "Manuel yapmaya göre ~{minutes} dakika kazandın.",
    productsLoading: "Ürünler yükleniyor...",
    aiAnalyzing: "AI analiz yapıyor...",
    aiProcessing: "Yapay zeka prompt'unuzu analiz ediyor",
    pleaseWait: "Bu işlem birkaç saniye sürebilir...",
    longOperation: "Bu işlem biraz zaman alabilir",
    variantAddNote: "Varyantları oluşturmak için önce ürün eklemeniz gerekmektedir.",
  },

  // AI Analiz durumları
  aiStatus: {
    promptReceived: "Prompt alındı",
    aiAnalyzing: "AI analiz ediyor",
    creatingVariants: "Varyantlar oluşturulacak",
  },

  // Onboarding
  onboarding: {
    welcome: "👋 Autovariant AI'a Hoş Geldiniz!",
    title: "Varyant oluşturmak hiç bu kadar kolay olmamıştı!",
    step1Title: "Ürün Seçin",
    step1Desc: "Mağazanızdaki ürünlerden varyant eklemek istediğinizi seçin",
    step2Title: "Doğal Dille Yazın",
    step2Desc: "\"S'den XL'e kadar, kırmızı mavi beyaz, 200 lira\" gibi yazın",
    step3Title: "AI Oluştursun",
    step3Desc: "Yapay zeka otomatik olarak tüm varyantları oluşturur",
    tip: "💡 İpucu: Fiyat kuralları da ekleyebilirsiniz! Örnek: '2XL ve sonrası için +100 lira'",
  },

  // Örnek promptlar
  examples: {
    simpleTitle: "Basit Beden ve Renk",
    simpleText: "S'den 3XL'e kadar tüm bedenler, kırmızı yeşil mavi renkler, fiyat 500 lira",
    priceRulesTitle: "Fiyat Kuralları ile",
    priceRulesText: "S'den 3XL'e kadar tüm bedenler, kırmızı yeşil mavi sarı mor renkler, temel fiyat 400 lira, 2XL ve sonrası için fiyat +100 lira",
    stockRulesTitle: "Stok Kuralları ile",
    stockRulesText: "S'den 3XL'e kadar tüm bedenler, kırmızı yeşil mavi renkler, fiyat 500 lira, her varyant için 10 adet stok, 2XL için 5 adet stok",
    specificSizesTitle: "Sadece Belirli Bedenler",
    specificSizesText: "M, L, XL bedenler, siyah beyaz kırmızı renkler, fiyat 600 lira",
    wideColorsTitle: "Geniş Renk Paleti",
    wideColorsText: "S'den 2XL'e kadar tüm bedenler, kırmızı yeşil mavi sarı mor turuncu pembe siyah beyaz renkler, fiyat 450 lira",
    basicTshirt: "Basic Tişört",
    sneaker: "Sneaker",
    dress: "Elbise",
  },

  // Tablo başlıkları
  table: {
    size: "Beden",
    color: "Renk",
    price: "Fiyat (₺)",
    stock: "Stok",
    actions: "İşlemler",
  },

  // Varyant işlemleri
  variantActions: {
    lockVariants: "🔒 Varyantları Kilitle",
    unlockVariants: "🔓 Kilidi Aç",
    editVariants: "Düzenle",
    deleteVariant: "Sil",
    locked: "Kilitli",
    unlocked: "Açık",
  },

  // Modal başlıkları
  modals: {
    saveTemplate: "Şablon Olarak Kaydet",
    promptExamples: "Prompt Örnekleri",
    confirmDelete: "Silmek istediğinize emin misiniz?",
  },

  // Durum badge'leri
  badges: {
    new: "Yeni",
    updated: "Güncellendi",
    ready: "Hazır",
    pending: "Bekliyor",
    error: "Hata",
  },

  // Sayısal formatlar
  formats: {
    currency: "₺",
    variantCount: "{count} varyant",
    photoCount: "{count} fotoğraf",
    productCount: "{count} ürün",
  },

  // Console log mesajları (debug için, kullanıcı görmez)
  console: {
    historySaveError: "Geçmiş kaydedilemedi:",
    historyReadError: "Geçmiş okunamadı:",
    historyDeleteError: "Geçmiş silinemedi:",
    templateSaveError: "Template kaydedilemedi:",
    templateReadError: "Template'ler okunamadı:",
    templateDeleteError: "Template silinemedi:",
    shopDomainError: "Shop domain okunurken hata:",
    loadError: "History/Template yükleme hatası:",
    onboardingCheckError: "Onboarding kontrolü hatası:",
    onboardingSaveError: "Onboarding kaydetme hatası:",
  },
};

/**
 * Placeholder değiştirme yardımcı fonksiyonu
 * Kullanım: formatText(texts.success.variantsCreated, { count: 10 })
 * Çıktı: "10 varyant başarıyla oluşturuldu! 🎉"
 */
export function formatText(text, params = {}) {
  let result = text;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

/**
 * i18n geçişi için hazırlık
 * Bu fonksiyon şimdilik texts objesinden değer döndürür
 * i18n entegrasyonunda t() fonksiyonu ile değiştirilecek
 */
export function t(key, params = {}) {
  const keys = key.split('.');
  let value = texts;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }
  
  if (typeof value === 'string' && Object.keys(params).length > 0) {
    return formatText(value, params);
  }
  
  return value;
}

export default texts;

