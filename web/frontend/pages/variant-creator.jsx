import { useState, useEffect, useMemo } from "react";
import {
  Page,
  Card,
  Layout,
  Select,
  TextField,
  Button,
  Banner,
  Spinner,
  Stack,
  Text,
  Badge,
  Modal,
  Checkbox,
  Collapsible,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useQuery } from "react-query";
import { texts, formatText } from "../utils/texts";

// Shopify Limitleri ve Sabitler
const SHOPIFY_LIMITS = {
  MAX_VARIANTS_PER_PRODUCT: 100, // Shopify hard limit
  MAX_OPTIONS_PER_PRODUCT: 3,    // Shopify hard limit
  MAX_OPTION_VALUES: 200,        // Per option
  MAX_STOCK_VALUE: 999999,       // Mantıklı üst limit
  MAX_PRICE_VALUE: 9999999,      // Mantıklı üst limit
  MAX_PRODUCTS_SELECTION: 20,    // Çoklu ürün seçimi için maksimum limit
};

// API Rate Limiting
const API_RATE_LIMIT = {
  MIN_INTERVAL_MS: 500,          // İstekler arası minimum süre (ms)
  lastRequestTime: 0,            // Son istek zamanı
};

// LocalStorage helper fonksiyonları
const VARIANT_HISTORY_KEY = "variant_creation_history";
const MAX_HISTORY_ITEMS = 10; // En fazla 10 kayıt tut

function saveToHistory(variantData) {
  try {
    const history = getHistory();
    const newItem = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      sizes: variantData.sizes || [],
      colors: variantData.colors || [],
      basePrice: variantData.basePrice || null,
      priceRules: variantData.priceRules || [],
      stockRules: variantData.stockRules || [],
      defaultStock: variantData.defaultStock || null,
      variantCount: variantData.variantCount || 0,
    };
    
    // Yeni item'ı başa ekle
    const updatedHistory = [newItem, ...history.filter(item => 
      // Aynı kombinasyon varsa eski olanı çıkar
      !(JSON.stringify(item.sizes.sort()) === JSON.stringify(newItem.sizes.sort()) &&
        JSON.stringify(item.colors.sort()) === JSON.stringify(newItem.colors.sort()))
    )].slice(0, MAX_HISTORY_ITEMS); // En fazla MAX_HISTORY_ITEMS kadar tut
    
    localStorage.setItem(VARIANT_HISTORY_KEY, JSON.stringify(updatedHistory));
    return updatedHistory;
  } catch (error) {
    console.error("Geçmiş kaydedilemedi:", error);
    return getHistory();
  }
}

function getHistory() {
  try {
    const history = localStorage.getItem(VARIANT_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error("Geçmiş okunamadı:", error);
    return [];
  }
}

function deleteFromHistory(itemId) {
  try {
    const history = getHistory();
    const updatedHistory = history.filter(item => item.id !== itemId);
    localStorage.setItem(VARIANT_HISTORY_KEY, JSON.stringify(updatedHistory));
    return updatedHistory;
  } catch (error) {
    console.error("Geçmiş silinemedi:", error);
    return getHistory();
  }
}

// Template helper fonksiyonları
const VARIANT_TEMPLATES_KEY = "variant_templates";

function saveTemplate(templateName, variantData) {
  try {
    const templates = getTemplates();
    const newTemplate = {
      id: Date.now().toString(),
      name: templateName,
      timestamp: new Date().toISOString(),
      sizes: variantData.sizes || [],
      colors: variantData.colors || [],
      basePrice: variantData.basePrice || null,
      priceRules: variantData.priceRules || [],
      stockRules: variantData.stockRules || [],
      defaultStock: variantData.defaultStock || null,
    };
    
    // Aynı isimde template varsa güncelle, yoksa yeni ekle
    const existingIndex = templates.findIndex(t => t.name.toLowerCase() === templateName.toLowerCase());
    if (existingIndex >= 0) {
      templates[existingIndex] = { ...newTemplate, id: templates[existingIndex].id };
    } else {
      templates.push(newTemplate);
    }
    
    localStorage.setItem(VARIANT_TEMPLATES_KEY, JSON.stringify(templates));
    return templates;
  } catch (error) {
    console.error("Template kaydedilemedi:", error);
    return getTemplates();
  }
}

function getTemplates() {
  try {
    const templates = localStorage.getItem(VARIANT_TEMPLATES_KEY);
    return templates ? JSON.parse(templates) : [];
  } catch (error) {
    console.error("Template'ler okunamadı:", error);
    return [];
  }
}

function deleteTemplate(templateId) {
  try {
    const templates = getTemplates();
    const updatedTemplates = templates.filter(t => t.id !== templateId);
    localStorage.setItem(VARIANT_TEMPLATES_KEY, JSON.stringify(updatedTemplates));
    return updatedTemplates;
  } catch (error) {
    console.error("Template silinemedi:", error);
    return getTemplates();
  }
}

/**
 * Fiyat kuralı condition'ını parse edip hangi varyantın etkileneceğini döndürür
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
  // Direkt renk eşleştirmesi (condition tam olarak renk adı ise, case-insensitive)
  if (currentColor) {
    const conditionClean = conditionLower.trim();
    const colorClean = currentColorLower.trim();
    
    // Tam eşleşme
    if (conditionClean === colorClean) {
      return true;
    }
    
    // Condition'da renk adı geçiyorsa (örn: "Kırmızı", "Kırmızı için", "kırmızı renkler")
    for (const [key, normalizedColor] of Object.entries(commonColors)) {
      // Condition'da bu renk var mı?
      if (conditionClean.includes(key) || conditionClean === key) {
        // Beden kelimesi yoksa
        if (!conditionClean.match(/\d+xl|xs|s|m|l|beden|size/i)) {
          // Color'da da bu renk var mı?
          if (colorClean.includes(normalizedColor) || colorClean === normalizedColor) {
            return true;
          }
        }
      }
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
  // ÖNEMLİ: Büyük bedenleri önce kontrol et (2XL, 3XL gibi), sonra küçük bedenleri (L, M, S)
  // Çünkü "2XL" içinde "L" geçiyor, bu yüzden önce büyük bedenleri kontrol etmeliyiz
  const sortedSizes = [...allSizes].sort((a, b) => b.length - a.length); // Uzun bedenleri önce
  for (const size of sortedSizes) {
    const sizeLower = size.toLowerCase();
    // Tam kelime eşleşmesi kontrolü - kelime sınırlarında veya başta/sonda
    // Örnek: "2xl" için "2xl için" → true, "2xl" için "xl" → false
    // Regex ile kelime sınırlarını kontrol et
    const sizePattern = sizeLower.replace(/\d+/g, '\\d+'); // Sayıları regex pattern'e çevir
    const exactMatchRegex = new RegExp(`(^|\\s)${sizePattern}(\\s|$)`, 'i');
    const exactMatch = conditionLower === sizeLower || exactMatchRegex.test(conditionLower);
    
    if (exactMatch && currentSizeUpper === size) {
      return true;
    }
  }
  
  return false;
}

export default function VariantCreator() {
  const shopify = useAppBridge();
  const [selectedProductId, setSelectedProductId] = useState(""); // Tek ürün seçimi (eski yöntem, geriye uyumluluk için)
  const [selectedProductIds, setSelectedProductIds] = useState([]); // Çoklu ürün seçimi
  const [useMultiSelect, setUseMultiSelect] = useState(false); // Çoklu seçim modu
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState(null);
  const [editableVariants, setEditableVariants] = useState([]); // Düzenlenebilir varyant listesi
  const [basePrice, setBasePrice] = useState(null); // Temel fiyat
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [creationProgress, setCreationProgress] = useState(null); // Progress tracking: { current: X, total: Y }
  const [history, setHistory] = useState([]); // Geçmiş kayıtlar
  const [templates, setTemplates] = useState([]); // Template'ler
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false); // Template kaydetme modal'ı
  const [templateName, setTemplateName] = useState(""); // Template ismi
  const [showExistingVariantWarning, setShowExistingVariantWarning] = useState(false); // Mevcut varyant uyarı modal'ı
  const [existingVariantInfo, setExistingVariantInfo] = useState(null); // Mevcut varyant bilgisi
  const [uploadedImages, setUploadedImages] = useState([]); // Yüklenen görseller: [{ id, file, preview, colorMatch: null }]
  const [isAnalyzingColors, setIsAnalyzingColors] = useState(false); // Renk analizi yapılıyor mu
  const [imageColorMatches, setImageColorMatches] = useState({}); // { imageId: colorName }
  const [isUploadingToShopify, setIsUploadingToShopify] = useState(false); // Shopify'a yükleme durumu
  const [uploadingProductId, setUploadingProductId] = useState(null); // Hangi ürün için yükleme yapılıyor
  const [productImageSelections, setProductImageSelections] = useState({}); // { productId: [imageIds] }
  const [productImages, setProductImages] = useState({}); // { productId: [{ id, file, preview, colorMatch }] }
  const [openProductSections, setOpenProductSections] = useState({}); // { productId: boolean } - Accordion için
  const [productImageColorMatches, setProductImageColorMatches] = useState({}); // { productId: { imageId: colorName } }
  const [variantsLocked, setVariantsLocked] = useState(false); // Varyantlar kilitli mi (oluşturulduktan sonra)
  const [productsReadyForImages, setProductsReadyForImages] = useState({}); // { productId: true }
  const [flowCompleted, setFlowCompleted] = useState(false); // Tüm akış bitti mi
  const [lastUploadStats, setLastUploadStats] = useState(null); // Son yükleme özeti
  const [showPromptExamples, setShowPromptExamples] = useState(false); // Prompt örnekleri modal'ı
  const [showHistory, setShowHistory] = useState(false); // Geçmiş kayıtları göster/gizle
  const [showTemplates, setShowTemplates] = useState(true); // Template'leri göster/gizle (varsayılan açık)
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false); // İlk kullanım mı?
  const [showOnboarding, setShowOnboarding] = useState(false); // Onboarding göster/gizle
  const [lastEditedValue, setLastEditedValue] = useState(null); // Son düzenlenen değer { type: 'price'|'stock', value: number, variantId: string }
  const [showApplyAllBanner, setShowApplyAllBanner] = useState(false); // Tümüne uygula banner'ı
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 }); // Yükleme ilerleme durumu
  const [draggedImageId, setDraggedImageId] = useState(null); // Sürüklenen görsel ID'si
  const [dragOverImageId, setDragOverImageId] = useState(null); // Üzerine gelinen görsel ID'si
  
  // Offline/Network durumu
  const [isOffline, setIsOffline] = useState(false); // Çevrimdışı mı?
  const [pendingRetry, setPendingRetry] = useState(null); // Bekleyen retry işlemi: { type: 'preview'|'create'|'analyze'|'upload', data: any }
  const [retryCountdown, setRetryCountdown] = useState(0); // Otomatik retry geri sayımı

  // İlk kullanım kontrolü
  const ONBOARDING_KEY = "autovariant_onboarding_completed";

  // Prompt örnekleri
  const promptExamples = [
    { title: texts.examples.simpleTitle, text: texts.examples.simpleText },
    { title: texts.examples.priceRulesTitle, text: texts.examples.priceRulesText },
    { title: texts.examples.stockRulesTitle, text: texts.examples.stockRulesText },
    { title: texts.examples.specificSizesTitle, text: texts.examples.specificSizesText },
    { title: texts.examples.wideColorsTitle, text: texts.examples.wideColorsText }
  ];

  // Aktif shop domain'ini URL query parametrelerinden oku (örn: ?shop=autovariantai.myshopify.com)
  const shopDomain = useMemo(() => {
    try {
      if (typeof window === "undefined") return null;
      const params = new URLSearchParams(window.location.search);
      const shop = params.get("shop");
      return shop || null;
    } catch (e) {
      console.error("Shop domain okunurken hata:", e);
      return null;
    }
  }, []);

  // Demo mode kontrolü
  const isDemoMode = useMemo(() => {
    try {
      if (typeof window === "undefined") return false;
      const params = new URLSearchParams(window.location.search);
      return params.get("demo") === "true" || params.get("demo") === "1";
    } catch (e) {
      return false;
    }
  }, []);

  // API base path (demo mode'da /api/demo kullan)
  // Her zaman relative URL kullan - Backend ve frontend aynı domain'de
  const apiBase = isDemoMode ? "/api/demo" : "/api";

  // Geçmiş kayıtları ve template'leri yükle
  useEffect(() => {
    try {
      setHistory(getHistory());
      setTemplates(getTemplates());
    } catch (error) {
      console.error("History/Template yükleme hatası:", error);
    }
  }, []);

  // İlk kullanım kontrolü
  useEffect(() => {
    try {
      const onboardingCompleted = localStorage.getItem(ONBOARDING_KEY);
      if (!onboardingCompleted) {
        setIsFirstTimeUser(true);
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error("Onboarding kontrolü hatası:", error);
    }
  }, []);

  // Onboarding'i tamamla
  const completeOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "true");
      setIsFirstTimeUser(false);
      setShowOnboarding(false);
    } catch (error) {
      console.error("Onboarding kaydetme hatası:", error);
    }
  };

  // Offline/Online detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Bağlantı geldiğinde bekleyen işlem varsa otomatik retry başlat
      if (pendingRetry) {
        setRetryCountdown(3); // 3 saniye sonra otomatik retry
      }
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      setRetryCountdown(0); // Offline olunca geri sayımı durdur
    };

    // İlk yüklemede durumu kontrol et
    if (typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingRetry]);

  // Otomatik retry geri sayımı
  useEffect(() => {
    if (retryCountdown > 0 && !isOffline) {
      const timer = setTimeout(() => {
        setRetryCountdown(retryCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (retryCountdown === 0 && pendingRetry && !isOffline) {
      // Geri sayım bitti, retry yap
      executeRetry();
    }
  }, [retryCountdown, isOffline]);

  // Retry işlemini çalıştır
  const executeRetry = async () => {
    if (!pendingRetry) return;
    
    const { type, data } = pendingRetry;
    setPendingRetry(null); // Retry başlamadan önce temizle
    
    try {
      switch (type) {
        case 'preview':
          await handlePreview(data.prompt);
          break;
        case 'create':
          await handleCreate();
          break;
        case 'analyze':
          if (data.productId) {
            await handleAnalyzeColorsForProduct(data.productId);
          } else {
            await handleAnalyzeColors();
          }
          break;
        case 'upload':
          await handleUploadImagesToShopify(data.productId);
          break;
        default:
          break;
      }
    } catch (err) {
      // Retry başarısız olursa tekrar kuyruğa ekle
      console.error("Retry başarısız:", err);
    }
  };

  // Bekleyen işlemi iptal et
  const cancelPendingRetry = () => {
    setPendingRetry(null);
    setRetryCountdown(0);
  };

  // Manuel retry tetikle
  const triggerManualRetry = () => {
    if (pendingRetry) {
      setRetryCountdown(0); // Hemen çalıştır
      executeRetry();
    }
  };

  // Akış adımı: 0 = Ürün & Prompt, 1 = Önizleme, 2 = Görsel Eşleme, 3 = Tamamlandı
  const currentStep = useMemo(() => {
    if (flowCompleted) return 3;
    if (!preview) return 0;
    if (!variantsLocked) return 1;
    return 2;
  }, [preview, variantsLocked, flowCompleted]);

  // Otomatik ilerleme: Varyantlar oluşturulunca görsel adımına scroll yap
  useEffect(() => {
    if (variantsLocked && currentStep === 2) {
      // Kısa bir gecikme ile scroll yap (DOM güncellenmesi için)
      setTimeout(() => {
        const imageSection = document.getElementById("image-upload-section");
        if (imageSection) {
          imageSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 500);
    }
  }, [variantsLocked, currentStep]);

  // Hata mesajı gösterildiğinde sayfanın en üstüne scroll yap
  useEffect(() => {
    if (error) {
      // Kısa bir gecikme ile scroll yap (DOM güncellenmesi için)
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    }
  }, [error]);

  const stepItems = [
    { id: 0, label: texts.steps.selectProduct },
    { id: 1, label: texts.steps.preview },
    { id: 2, label: texts.steps.images },
    { id: 3, label: texts.steps.finish },
  ];

  const getStepStatus = (stepId) => {
    if (currentStep === stepId) return "current";
    if (currentStep > stepId) return "done";
    return "upcoming";
  };

  // Adım bazlı yardım metinleri
  const getStepHelpText = (stepId) => {
    switch (stepId) {
      case 0:
        return texts.stepHelp.step0;
      case 1:
        return texts.stepHelp.step1;
      case 2:
        return texts.stepHelp.step2;
      case 3:
        return texts.stepHelp.step3;
      default:
        return "";
    }
  };

  // Belirli bir renk için varyant özetini üret
  const getVariantSummaryForColor = (colorName) => {
    if (!colorName || !editableVariants || editableVariants.length === 0) {
      return null;
    }
    const variantsForColor = editableVariants.filter(
      (v) => (v.color || "").toLowerCase() === colorName.toLowerCase()
    );
    if (variantsForColor.length === 0) return null;

    const sizes = Array.from(
      new Set(variantsForColor.map((v) => v.size).filter(Boolean))
    );
    const previewSizes = sizes.slice(0, 3).join(", ");
    const moreCount = sizes.length - 3;

    return {
      totalVariants: variantsForColor.length,
      sizesPreview: previewSizes,
      moreSizesCount: moreCount > 0 ? moreCount : 0,
    };
  };

  // Ürünleri yükle - Arka planda yükle, kullanıcıyı bloklama
  const {
    data: productsData,
    isLoading: isLoadingProducts,
    isFetching: isFetchingProducts,
    error: productsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ["products", isDemoMode],
    queryFn: async () => {
      // Production'da relative URL kullan - Backend ve frontend aynı domain'de
      // window.location.origin Shopify iframe içinde farklı olabilir
      const endpoint = isDemoMode 
        ? `${apiBase}/products/list` 
        : "/api/products/list"; // Her zaman relative URL - backend aynı domain'de
      
      console.log(`🚀 Starting products fetch to: ${endpoint}`);
      console.log(`🔍 isDemoMode: ${isDemoMode}, apiBase: ${apiBase}`);
      console.log(`🔍 window.location.origin: ${window.location.origin}`);
      console.log(`🔍 window.location.href: ${window.location.href}`);
      
      // SCENARIO 9: Frontend timeout - 10 saniye (daha kısa, hızlı feedback için)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error("⏱️⏱️⏱️ FETCH TIMEOUT AFTER 10s - BACKEND NOT RESPONDING ⏱️⏱️⏱️");
        console.error("⏱️ Endpoint:", endpoint);
        console.error("⏱️ This indicates backend is not responding or request is being blocked");
        controller.abort();
      }, 10000); // 10 saniye
      
      try {
        const fetchStartTime = Date.now();
        console.log(`🔍 Fetch starting at ${new Date().toISOString()}`);
        
        // Basit fetch - minimum header'lar
        const response = await fetch(endpoint, {
          signal: controller.signal,
          credentials: 'include', // Session cookie'lerini gönder
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          cache: 'no-store', // Cache'i tamamen devre dışı bırak
        });
        clearTimeout(timeoutId);
        const fetchDuration = Date.now() - fetchStartTime;
        console.log(`⏱️ Fetch completed in ${fetchDuration}ms`);
        
        // Response'u parse etmeden önce status kontrolü
        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || `HTTP ${response.status}` };
          }
          console.error("❌ API Error Response:", {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });
          throw new Error(errorData.error || `HTTP ${response.status}: Ürünler yüklenemedi`);
        }
        
        const data = await response.json();
        console.log("📦 Products API response:", {
          status: response.status,
          ok: response.ok,
          productsCount: data.products?.length || 0,
          error: data.error,
          hasProducts: !!data.products,
          isArray: Array.isArray(data.products)
        });
        
        // products array'i kontrol et
        if (!data.products) {
          console.warn("⚠️ No products field in response:", data);
          return { products: [], error: data.error || "Ürünler bulunamadı" };
        }
        
        if (!Array.isArray(data.products)) {
          console.warn("⚠️ Invalid products data format (not array):", data);
          return { products: [], error: "Geçersiz veri formatı" };
        }
        
        console.log(`✅ Successfully loaded ${data.products.length} products`);
        return { products: data.products, error: data.error };
      } catch (error) {
        clearTimeout(timeoutId);
        console.error("❌❌❌ Products fetch error:", {
          name: error.name,
          message: error.message,
          stack: error.stack?.substring(0, 500),
          endpoint: endpoint,
          isAbortError: error.name === 'AbortError'
        });
        
        // AbortError ise özel mesaj göster
        if (error.name === 'AbortError') {
          return { 
            products: [], 
            error: "Backend yanıt vermiyor. Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin." 
          };
        }
        
        // Hata durumunda error bilgisi ile döndür
        return { 
          products: [], 
          error: error.message || "Bağlantı hatası. Lütfen tekrar deneyin." 
        };
      }
    },
    refetchOnWindowFocus: false,
    enabled: true,
    retry: 1, // 1 kez tekrar dene (çok fazla retry loading'i uzatır)
    retryDelay: 1000, // 1 saniye bekle
    staleTime: 30000,
    // Timeout ekle - 10 saniye sonra loading'i bitir
    gcTime: 60000, // Cache time
  });

  // Prompt'u parse et ve önizleme göster
  const handlePreview = async (customPrompt = null) => {
    const promptToUse = customPrompt !== null ? customPrompt : prompt;
    
    if (!promptToUse || !promptToUse.trim()) {
      setError(texts.errors.emptyPrompt);
      return;
    }

    // Prompt uzunluk kontrolü (max 1000 karakter)
    const MAX_PROMPT_LENGTH = 1000;
    if (promptToUse.length > MAX_PROMPT_LENGTH) {
      setError(
        `⚠️ Prompt çok uzun!\n\n` +
        `Mevcut: ${promptToUse.length} karakter\n` +
        `Maksimum: ${MAX_PROMPT_LENGTH} karakter\n\n` +
        `Lütfen prompt'unuzu kısaltın.`
      );
      return;
    }

    setError(null);
    setPreview(null);
    setIsLoadingPreview(true);
    setFlowCompleted(false);
    setLastUploadStats(null);
    setVariantsLocked(false);
    setProductsReadyForImages({});
    setUploadedImages([]);
    setProductImages({});
    setProductImageSelections({});
    setProductImageColorMatches({});
    setImageColorMatches({});
    setOpenProductSections({});
    setUploadingProductId(null);
    setIsUploadingToShopify(false);

    try {
      const endpoint = isDemoMode 
        ? `${apiBase}/variants/parse` 
        : "/api/variants/parse";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptToUse }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Backend'den gelen detaylı hata mesajını kullan
        const errorMsg = data.error || "Önizleme oluşturulamadı";
        setError(errorMsg);
        return;
      }

      setPreview(data.parsed);
      
      // Temel fiyatı ayarla
      setBasePrice(data.parsed.basePrice || null);

      // Debug: Parse edilen stok bilgisini kontrol et
      console.log("🔍 Parse edilen stok bilgisi:", {
        defaultStock: data.parsed.defaultStock,
        defaultStockType: typeof data.parsed.defaultStock,
        stockRules: data.parsed.stockRules,
      });

      // Düzenlenebilir varyant listesini oluştur
      const sizes = data.parsed.sizes.length > 0 ? data.parsed.sizes : ["Standart"];
      const colors = data.parsed.colors.length > 0 ? data.parsed.colors : ["Standart"];
      const variants = [];
      const sizeOrder = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
      const colorOrder = data.parsed.colors || [];
      const getOrderIndex = (arr, value) => {
        const index = arr.indexOf(value);
        return index === -1 ? arr.length : index;
      };
      
      sizes.forEach((size, sizeIndex) => {
        colors.forEach((color, colorIndex) => {
          let variantPrice = data.parsed.basePrice ? parseFloat(data.parsed.basePrice) : 0;
          // defaultStock'u sayıya çevir (string olabilir)
          let variantStock = data.parsed.defaultStock !== undefined && data.parsed.defaultStock !== null 
            ? parseInt(data.parsed.defaultStock, 10) || 0 
            : 0;

          // Fiyat kurallarını uygula
          if (data.parsed.priceRules && data.parsed.priceRules.length > 0) {
            data.parsed.priceRules.forEach((rule) => {
              if (shouldApplyPriceRule(rule.condition || "", size, color)) {
                if (rule.increase) {
                  variantPrice += rule.increase;
                } else if (rule.decrease) {
                  variantPrice -= rule.decrease;
                } else if (rule.increasePercentage) {
                  const percentage = parseFloat(rule.increasePercentage) || 0;
                  variantPrice += (variantPrice * percentage) / 100;
                } else if (rule.decreasePercentage) {
                  const percentage = parseFloat(rule.decreasePercentage) || 0;
                  variantPrice -= (variantPrice * percentage) / 100;
                }
              }
            });
          }

          // Stok kurallarını uygula
          if (data.parsed.stockRules && data.parsed.stockRules.length > 0) {
            data.parsed.stockRules.forEach((rule) => {
              const condition = rule.condition || "";
              const quantity = rule.quantity !== undefined ? parseInt(rule.quantity, 10) : null;
              
              if (quantity === null || Number.isNaN(quantity)) {
                return; // Geçersiz quantity, atla
              }

              // Genel kurallar (tümü için)
              const conditionLower = condition.toLowerCase().trim();
              if (conditionLower === "tümü" || conditionLower === "hepsi" || conditionLower === "her biri" || conditionLower === "genel" || conditionLower === "default") {
                variantStock = quantity;
                return;
              }
              
              // Beden veya renk bazlı kurallar için shouldApplyPriceRule kullan (daha güvenilir)
              if (shouldApplyPriceRule(condition, size, color)) {
                variantStock = quantity;
              }
            });
          }

          // Karşılaştırma fiyatını hesapla (varsa)
          let variantCompareAtPrice = null;
          
          // ÖNEMLİ: Eğer compareAtPriceRules varsa, sadece kuralları uygula (genel compareAtPrice'ı kullanma)
          // Eğer compareAtPriceRules yoksa, genel compareAtPrice'ı kullan
          if (data.parsed.compareAtPriceRules && data.parsed.compareAtPriceRules.length > 0) {
            // Kurallar varsa, sadece eşleşen kuralları uygula
            data.parsed.compareAtPriceRules.forEach((rule) => {
              if (shouldApplyPriceRule(rule.condition || "", size, color)) {
                variantCompareAtPrice = rule.value || variantCompareAtPrice;
              }
            });
            // Eğer hiçbir kural eşleşmediyse, null kalır (genel compareAtPrice kullanılmaz)
          } else {
            // Kurallar yoksa, genel compareAtPrice'ı kullan
            variantCompareAtPrice = data.parsed.compareAtPrice || null;
          }

          variants.push({
            id: `${sizeIndex}-${colorIndex}`,
            size,
            color,
            price: variantPrice.toFixed(2),
            compareAtPrice: variantCompareAtPrice ? parseFloat(variantCompareAtPrice).toFixed(2) : null,
            stock: variantStock,
          });
        });
      });

      variants.sort((a, b) => {
        if (colorOrder.length > 0) {
          const colorDiff =
            getOrderIndex(colorOrder, a.color) - getOrderIndex(colorOrder, b.color);
          if (colorDiff !== 0) {
            return colorDiff;
          }
        }
        return getOrderIndex(sizeOrder, a.size) - getOrderIndex(sizeOrder, b.size);
      });

      // 🔴 100 VARYANT LİMİT KONTROLÜ (Shopify Hard Limit)
      if (variants.length > SHOPIFY_LIMITS.MAX_VARIANTS_PER_PRODUCT) {
        setError(
          `⚠️ Shopify Limiti Aşıldı!\n\n` +
          `Oluşturmak istediğiniz varyant sayısı: ${variants.length}\n` +
          `Shopify maksimum limiti: ${SHOPIFY_LIMITS.MAX_VARIANTS_PER_PRODUCT}\n\n` +
          `Lütfen beden veya renk sayısını azaltın.\n` +
          `Örnek: ${data.parsed.sizes.length} beden × ${data.parsed.colors.length} renk = ${variants.length} varyant`
        );
        setIsLoadingPreview(false);
        return;
      }

      // ⚠️ 80+ varyant uyarısı (limite yaklaşıyor)
      if (variants.length > 80) {
        shopify.toast.show(
          `Dikkat: ${variants.length} varyant oluşturulacak. Shopify limiti 100'dür.`,
          { duration: 5000, isError: false }
        );
      }

      setEditableVariants(variants);

      // Önizleme başarılı mesajı
      if (data.parsed.sizes.length > 0 || data.parsed.colors.length > 0) {
        setSuccess(null);
      } else {
        setError("Prompt'tan beden veya renk bilgisi çıkarılamadı");
      }
    } catch (err) {
      // Network hataları veya diğer beklenmeyen hatalar
      const isNetworkError = err.message.includes("Failed to fetch");
      const errorMsg = isNetworkError
        ? "Bağlantı hatası: Sunucuya erişilemiyor. Lütfen internet bağlantınızı kontrol edin."
        : `Önizleme oluşturulurken bir hata oluştu: ${err.message}`;
      setError(errorMsg);
      
      // Network hatası ise retry kuyruğuna ekle
      if (isNetworkError) {
        setPendingRetry({ type: 'preview', data: { prompt: promptToUse } });
      }
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Varyant düzenleme fonksiyonları
  const updateVariantPrice = (variantId, newPrice) => {
    if (variantsLocked) return;
    
    // Negatif değer kontrolü
    const priceValue = parseFloat(newPrice);
    if (!isNaN(priceValue) && priceValue < 0) {
      setError("⚠️ Fiyat negatif olamaz! Lütfen 0 veya pozitif bir değer girin.");
      return; // Negatif değeri kabul etme
    }
    
    const finalPrice = isNaN(priceValue) ? 0 : priceValue;
    setEditableVariants(prev => 
      prev.map(v => 
        v.id === variantId 
          ? { ...v, price: finalPrice }
          : v
      )
    );
    // Son düzenlenen değeri kaydet ve banner'ı göster
    setLastEditedValue({ type: 'price', value: finalPrice, variantId });
    setShowApplyAllBanner(true);
  };

  const updateVariantStock = (variantId, newStock) => {
    if (variantsLocked) return;
    
    // Negatif değer kontrolü
    const stockValue = parseInt(newStock);
    if (!isNaN(stockValue) && stockValue < 0) {
      setError("⚠️ Stok negatif olamaz! Lütfen 0 veya pozitif bir değer girin.");
      return; // Negatif değeri kabul etme
    }
    
    const finalStock = isNaN(stockValue) ? 0 : stockValue;
    setEditableVariants(prev => 
      prev.map(v => 
        v.id === variantId 
          ? { ...v, stock: finalStock }
          : v
      )
    );
    // Son düzenlenen değeri kaydet ve banner'ı göster
    setLastEditedValue({ type: 'stock', value: finalStock, variantId });
    setShowApplyAllBanner(true);
  };

  const updateVariantCompareAtPrice = (variantId, newCompareAtPrice) => {
    if (variantsLocked) return;
    
    // Boş string ise null yap
    if (newCompareAtPrice === "" || newCompareAtPrice === null || newCompareAtPrice === undefined) {
      const compareValue = null;
      setEditableVariants(prev => 
        prev.map(v => 
          v.id === variantId 
            ? { ...v, compareAtPrice: compareValue }
            : v
        )
      );
      return;
    }
    
    // Negatif değer kontrolü
    const compareValue = parseFloat(newCompareAtPrice);
    if (isNaN(compareValue) || compareValue < 0) {
      setError("⚠️ Karşılaştırma fiyatı negatif olamaz! Lütfen 0 veya pozitif bir değer girin.");
      return;
    }
    
    // Mantık kontrolü: Karşılaştırma fiyatı satış fiyatından büyük olmalı
    const variant = editableVariants.find(v => v.id === variantId);
    if (variant) {
      const price = parseFloat(variant.price) || 0;
      if (compareValue <= price) {
        setError(`⚠️ Karşılaştırma fiyatı (${compareValue}₺) satış fiyatından (${price}₺) büyük olmalı!`);
        return;
      }
    }
    
    setEditableVariants(prev => 
      prev.map(v => 
        v.id === variantId 
          ? { ...v, compareAtPrice: compareValue }
          : v
      )
    );
    // Son düzenlenen değeri kaydet ve banner'ı göster
    setLastEditedValue({ type: 'compareAtPrice', value: compareValue, variantId });
    setShowApplyAllBanner(true);
  };

  // Tüm varyantlara değer uygula
  const applyValueToAll = () => {
    if (!lastEditedValue || variantsLocked) return;
    
    setEditableVariants(prev => 
      prev.map(v => ({
        ...v,
        [lastEditedValue.type]: lastEditedValue.value
      }))
    );
    setShowApplyAllBanner(false);
    setLastEditedValue(null);
  };

  // Banner'ı kapat
  const dismissApplyAllBanner = () => {
    setShowApplyAllBanner(false);
    setLastEditedValue(null);
  };

  const deleteVariant = (variantId) => {
    if (variantsLocked) return;
    setEditableVariants(prev => prev.filter(v => v.id !== variantId));
  };

  // Geçmiş kayıttan prompt oluştur
  const generatePromptFromHistory = (historyItem) => {
    let prompt = "";
    
    // Bedenler
    if (historyItem.sizes && historyItem.sizes.length > 0) {
      prompt += historyItem.sizes.join(", ") + " bedenler";
    }
    
    // Renkler
    if (historyItem.colors && historyItem.colors.length > 0) {
      if (prompt) prompt += ", ";
      prompt += historyItem.colors.join(", ") + " renkler";
    }
    
    // Temel fiyat
    if (historyItem.basePrice) {
      if (prompt) prompt += ", ";
      prompt += `fiyat ${historyItem.basePrice} lira`;
    }
    
    // Fiyat kuralları
    if (historyItem.priceRules && historyItem.priceRules.length > 0) {
      historyItem.priceRules.forEach(rule => {
        if (prompt) prompt += ", ";
        if (rule.increase) {
          prompt += `${rule.condition} için fiyat +${rule.increase} lira`;
        } else if (rule.decrease) {
          prompt += `${rule.condition} için fiyat -${rule.decrease} lira`;
        } else if (rule.increasePercentage) {
          prompt += `${rule.condition} için fiyat %${rule.increasePercentage} artır`;
        } else if (rule.decreasePercentage) {
          prompt += `${rule.condition} için fiyat %${rule.decreasePercentage} azalt`;
        }
      });
    }
    
    // Stok kuralları
    if (historyItem.defaultStock) {
      if (prompt) prompt += ", ";
      prompt += `her varyant için ${historyItem.defaultStock} adet stok`;
    }
    
    if (historyItem.stockRules && historyItem.stockRules.length > 0) {
      historyItem.stockRules.forEach(rule => {
        if (prompt) prompt += ", ";
        prompt += `${rule.condition} için ${rule.quantity} adet stok`;
      });
    }
    
    return prompt;
  };

  // Geçmiş kaydı kullan
  const useHistoryItem = (historyItem) => {
    const generatedPrompt = generatePromptFromHistory(historyItem);
    setPrompt(generatedPrompt);
    // Önizlemeyi otomatik oluştur (prompt'u direkt geçir)
    handlePreview(generatedPrompt);
  };

  // Geçmiş kaydı sil
  const removeHistoryItem = (itemId) => {
    const updatedHistory = deleteFromHistory(itemId);
    setHistory(updatedHistory);
  };

  // Template kaydet
  const handleSaveTemplate = () => {
    const trimmedName = templateName.trim();
    
    if (!trimmedName) {
      setError("Lütfen template için bir isim girin");
      return;
    }

    if (!preview) {
      setError("Lütfen önce önizleme oluşturun");
      return;
    }

    const templateData = {
      sizes: preview.sizes || [],
      colors: preview.colors || [],
      basePrice: preview.basePrice || basePrice,
      priceRules: preview.priceRules || [],
      stockRules: preview.stockRules || [],
      defaultStock: preview.defaultStock || null,
    };

    const updatedTemplates = saveTemplate(trimmedName, templateData);
    setTemplates(updatedTemplates);
    setShowSaveTemplateModal(false);
    setSuccess(`"${trimmedName}" template'i başarıyla kaydedildi! 🎉`);
    setTemplateName("");
  };

  // Template kullan
  const useTemplate = (template) => {
    const generatedPrompt = generatePromptFromHistory(template);
    setPrompt(generatedPrompt);
    handlePreview(generatedPrompt);
    setSuccess(`"${template.name}" template'i yüklendi! Önizleme oluşturuluyor...`);
    shopify.toast.show(`"${template.name}" template'i yüklendi!`, { duration: 3000 });
  };

  // Template sil
  const removeTemplate = (templateId) => {
    const updatedTemplates = deleteTemplate(templateId);
    setTemplates(updatedTemplates);
  };

  // Görsel yükleme (genel veya ürün bazlı)
  const handleImageUpload = (files, productId = null) => {
    const newImages = Array.from(files).map((file) => {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const preview = URL.createObjectURL(file);
      return {
        id,
        file,
        preview,
        colorMatch: null,
      };
    });

    if (productId && useMultiSelect) {
      // Çoklu seçim modunda ürün bazlı yükleme
      setProductImages(prev => ({
        ...prev,
        [productId]: [...(prev[productId] || []), ...newImages]
      }));
    } else {
      // Tek seçim modunda genel yükleme
      setUploadedImages([...uploadedImages, ...newImages]);
    }
  };

  // Görsel silme (genel veya ürün bazlı)
  const removeImage = (imageId, productId = null) => {
    if (productId && useMultiSelect) {
      // Çoklu seçim modunda ürün bazlı silme
      setProductImages(prev => {
        const productImages = prev[productId] || [];
        const imageToRemove = productImages.find(img => img.id === imageId);
        if (imageToRemove) {
          URL.revokeObjectURL(imageToRemove.preview);
        }
        return {
          ...prev,
          [productId]: productImages.filter(img => img.id !== imageId)
        };
      });
      // productImageColorMatches'den de sil
      setProductImageColorMatches(prev => {
        const newMatches = { ...(prev[productId] || {}) };
        delete newMatches[imageId];
        return {
          ...prev,
          [productId]: newMatches
        };
      });
    } else {
      // Tek seçim modunda genel silme
      setUploadedImages(uploadedImages.filter(img => {
        if (img.id === imageId) {
          URL.revokeObjectURL(img.preview); // Memory leak önleme
          return false;
        }
        return true;
      }));
      // imageColorMatches'den de sil
      const newMatches = { ...imageColorMatches };
      delete newMatches[imageId];
      setImageColorMatches(newMatches);
    }
  };

  // Drag & Drop ile görsel sıralama
  const handleDragStart = (e, imageId) => {
    setDraggedImageId(imageId);
    e.dataTransfer.effectAllowed = "move";
    // Drag sırasında görüntüyü yarı saydam yap
    e.currentTarget.style.opacity = "0.5";
  };

  const handleDragEnd = (e) => {
    setDraggedImageId(null);
    setDragOverImageId(null);
    e.currentTarget.style.opacity = "1";
  };

  const handleDragOver = (e, imageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (imageId !== draggedImageId) {
      setDragOverImageId(imageId);
    }
  };

  const handleDragLeave = (e) => {
    setDragOverImageId(null);
  };

  const handleDrop = (e, targetImageId) => {
    e.preventDefault();
    
    if (!draggedImageId || draggedImageId === targetImageId) {
      setDraggedImageId(null);
      setDragOverImageId(null);
      return;
    }

    // Görselleri yeniden sırala
    setUploadedImages(prev => {
      const newImages = [...prev];
      const draggedIndex = newImages.findIndex(img => img.id === draggedImageId);
      const targetIndex = newImages.findIndex(img => img.id === targetImageId);
      
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      // Sürüklenen öğeyi çıkar
      const [draggedItem] = newImages.splice(draggedIndex, 1);
      // Hedef konuma ekle
      newImages.splice(targetIndex, 0, draggedItem);
      
      return newImages;
    });

    setDraggedImageId(null);
    setDragOverImageId(null);
  };

  // Renk analizi (AI ile)
  const handleAnalyzeColors = async () => {
    if (uploadedImages.length === 0) {
      setError("Lütfen önce görsel yükleyin");
      return;
    }

    if (!preview || !preview.colors || preview.colors.length === 0) {
      setError("Lütfen önce varyant önizlemesi oluşturun");
      return;
    }

    setIsAnalyzingColors(true);
    setError(null);

    try {
      // FormData oluştur
      const formData = new FormData();
      uploadedImages.forEach((img) => {
        formData.append('images', img.file);
        formData.append('imageIds', img.id); // Her görsel için ID gönder
      });
      formData.append('colors', JSON.stringify(preview.colors));

      const endpoint = isDemoMode 
        ? `${apiBase}/images/analyze-colors` 
        : "/api/images/analyze-colors";
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Renk analizi yapılamadı");
        return;
      }

      // Eşleştirme sonuçlarını kaydet (imageId ile eşleştir)
      const matches = {};
      data.matches.forEach((match, index) => {
        // Backend'den gelen imageId veya frontend'den gönderdiğimiz ID'yi kullan
        const imageId = uploadedImages[index]?.id || match.imageId;
        matches[imageId] = match.color;
      });
      setImageColorMatches(matches);

      // Uploaded images'ı güncelle
      setUploadedImages(uploadedImages.map(img => ({
        ...img,
        colorMatch: matches[img.id] || null,
      })));

      setSuccess("Renk analizi tamamlandı! Lütfen eşleştirmeleri kontrol edin.");
    } catch (err) {
      const isNetworkError = err.message.includes("Failed to fetch");
      const errorMsg = isNetworkError
        ? "Bağlantı hatası: Sunucuya erişilemiyor. Lütfen internet bağlantınızı kontrol edin."
        : `Renk analizi yapılırken bir hata oluştu: ${err.message}`;
      setError(errorMsg);
      
      // Network hatası ise retry kuyruğuna ekle
      if (isNetworkError) {
        setPendingRetry({ type: 'analyze', data: { productId: null } });
      }
    } finally {
      setIsAnalyzingColors(false);
    }
  };

  // Manuel renk eşleştirmesi değiştirme (genel veya ürün bazlı)
  const updateImageColorMatch = (imageId, colorName, productId = null) => {
    if (productId && useMultiSelect) {
      // Çoklu seçim modunda ürün bazlı
      setProductImageColorMatches(prev => ({
        ...prev,
        [productId]: {
          ...(prev[productId] || {}),
          [imageId]: colorName
        }
      }));
      setProductImages(prev => ({
        ...prev,
        [productId]: (prev[productId] || []).map(img => 
          img.id === imageId ? { ...img, colorMatch: colorName } : img
        )
      }));
    } else {
      // Tek seçim modunda genel
      const newMatches = { ...imageColorMatches };
      newMatches[imageId] = colorName;
      setImageColorMatches(newMatches);
      
      setUploadedImages(uploadedImages.map(img => 
        img.id === imageId ? { ...img, colorMatch: colorName } : img
      ));
    }
  };

  // Ürün bazlı renk analizi
  const handleAnalyzeColorsForProduct = async (productId) => {
    const productImagesList = productImages[productId] || [];
    
    if (productImagesList.length === 0) {
      setError("Lütfen önce bu ürün için görsel yükleyin");
      return;
    }

    if (!preview || !preview.colors || preview.colors.length === 0) {
      setError("Lütfen önce varyant önizlemesi oluşturun");
      return;
    }

    setIsAnalyzingColors(true);
    setError(null);

    try {
      const formData = new FormData();
      productImagesList.forEach((img) => {
        formData.append('images', img.file);
        formData.append('imageIds', img.id);
      });
      formData.append('colors', JSON.stringify(preview.colors));

      const endpoint = isDemoMode 
        ? `${apiBase}/images/analyze-colors` 
        : "/api/images/analyze-colors";
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Renk analizi yapılamadı");
        return;
      }

      // Eşleştirme sonuçlarını kaydet
      const matches = {};
      data.matches.forEach((match, index) => {
        const imageId = productImagesList[index]?.id || match.imageId;
        matches[imageId] = match.color;
      });

      setProductImageColorMatches(prev => ({
        ...prev,
        [productId]: matches
      }));

      // Product images'ı güncelle
      setProductImages(prev => ({
        ...prev,
        [productId]: (prev[productId] || []).map(img => ({
          ...img,
          colorMatch: matches[img.id] || null,
        }))
      }));

      setSuccess(`${productImagesList.length} görsel için renk analizi tamamlandı!`);
    } catch (err) {
      const isNetworkError = err.message.includes("Failed to fetch");
      const errorMsg = isNetworkError
        ? "Bağlantı hatası: Sunucuya erişilemiyor. Lütfen internet bağlantınızı kontrol edin."
        : `Renk analizi yapılırken bir hata oluştu: ${err.message}`;
      setError(errorMsg);
      
      // Network hatası ise retry kuyruğuna ekle
      if (isNetworkError) {
        setPendingRetry({ type: 'analyze', data: { productId } });
      }
    } finally {
      setIsAnalyzingColors(false);
    }
  };

  // Görselleri Shopify'a yükle ve varyantlara ata
  const handleUploadImagesToShopify = async (productIdParam = null) => {
    const productIdToUse = productIdParam || (useMultiSelect ? (selectedProductIds.length > 0 ? selectedProductIds[0] : null) : selectedProductId);
    
    if (!productIdToUse) {
      setError("Lütfen bir ürün seçin");
      return;
    }

    // Çoklu seçim modunda: Ürün bazlı görselleri kullan
    let imagesToUpload = [];
    let colorMatchesToUse = {};
    
    if (useMultiSelect) {
      const productImagesList = productImages[productIdToUse] || [];
      imagesToUpload = productImagesList.filter(img => img.colorMatch);
      colorMatchesToUse = productImageColorMatches[productIdToUse] || {};
      
      if (imagesToUpload.length === 0) {
        setError("Bu ürün için renk eşleştirmesi yapılmış görsel bulunamadı. Lütfen önce 'Renklere Ayır' butonuna tıklayın.");
        return;
      }
    } else {
      // Tek seçim modu: Genel görselleri kullan
      imagesToUpload = uploadedImages.filter(img => img.colorMatch);
      colorMatchesToUse = imageColorMatches;
      
      if (imagesToUpload.length === 0) {
        setError("Lütfen önce 'Renklere Ayır' butonuna tıklayarak görselleri renklere eşleştirin");
        return;
      }
    }

    setIsUploadingToShopify(true);
    setUploadingProductId(productIdToUse);
    setUploadProgress({ current: 0, total: imagesToUpload.length });
    setError(null);
    shopify.loading(true);

    try {
      const formData = new FormData();
      
      // Seçilen görselleri gönder
      imagesToUpload.forEach((img) => {
        formData.append('images', img.file);
        formData.append('imageIds', img.id);
      });
      
      formData.append('productId', productIdToUse);
      formData.append('imageColorMatches', JSON.stringify(colorMatchesToUse));

      const endpoint = isDemoMode 
        ? `${apiBase}/images/upload-to-shopify` 
        : "/api/images/upload-to-shopify";
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Görseller yüklenirken bir hata oluştu");
        shopify.toast.show(data.error || "Görseller yüklenirken bir hata oluştu", { isError: true });
        return;
      }

      const productName = productsData?.products?.find(p => p.id === productIdToUse)?.title || "ürün";
      setSuccess(`${productName} için ${data.uploaded} görsel başarıyla Shopify'a yüklendi ve varyantlara atandı! 🎉`);
      shopify.toast.show(`${productName} için ${data.uploaded} görsel başarıyla yüklendi!`, { isError: false });
      setFlowCompleted(true);
      setLastUploadStats({
        productName,
        uploaded: data.uploaded || 0,
        variantCount: editableVariants.length,
        productId: productIdToUse,
      });
      
    } catch (err) {
      const isNetworkError = err.message.includes("Failed to fetch");
      const errorMsg = isNetworkError
        ? "Bağlantı hatası: Sunucuya erişilemiyor. Lütfen internet bağlantınızı kontrol edin."
        : `Görseller yüklenirken bir hata oluştu: ${err.message}`;
      setError(errorMsg);
      shopify.toast.show(errorMsg, { isError: true });
      
      // Network hatası ise retry kuyruğuna ekle
      if (isNetworkError) {
        setPendingRetry({ type: 'upload', data: { productId: productIdToUse } });
      }
    } finally {
      setIsUploadingToShopify(false);
      setUploadingProductId(null);
      shopify.loading(false);
    }
  };

  // Çoklu seçim modunda görsel seçimi toggle
  const toggleProductImageSelection = (productId, imageId) => {
    setProductImageSelections(prev => {
      const current = prev[productId] || [];
      const isSelected = current.includes(imageId);
      
      return {
        ...prev,
        [productId]: isSelected
          ? current.filter(id => id !== imageId)
          : [...current, imageId]
      };
    });
  };

  // Tüm görselleri seç/seçimi kaldır
  const toggleAllImagesForProduct = (productId, selectAll = true) => {
    const imagesWithColor = uploadedImages.filter(img => img.colorMatch).map(img => img.id);
    
    setProductImageSelections(prev => ({
      ...prev,
      [productId]: selectAll ? imagesWithColor : []
    }));
  };

  // Ürün bazlı görsel yükleme bölümünü render et
  const renderProductImageSection = (productId, productImagesList, isReadyForImages) => {
    try {
      if (!isReadyForImages) {
        return (
          <Banner status="warning" title="Varyantlar eklenmeden fotoğraf yüklenemez">
            <Text as="p" variant="bodySm">
              Seçili ürün için varyantları başarıyla oluşturduktan sonra fotoğrafları ekleyebilirsiniz.
            </Text>
          </Banner>
        );
      }

      const isMultiProduct = Boolean(productId && useMultiSelect);
      const analyzeHandler = isMultiProduct
        ? () => handleAnalyzeColorsForProduct(productId)
        : handleAnalyzeColors;
      const analyzeDisabled =
        isAnalyzingColors || !preview || !preview.colors || preview.colors.length === 0;
      const hasColorMatches = productImagesList.some((img) => img.colorMatch);
      const uploadHandler = isMultiProduct
        ? () => handleUploadImagesToShopify(productId)
        : () => handleUploadImagesToShopify();
      const isUploadingForProduct = isMultiProduct
        ? isUploadingToShopify && uploadingProductId === productId
        : isUploadingToShopify;
      const uploadDisabled = isMultiProduct
        ? (isUploadingToShopify && uploadingProductId !== productId) || !hasColorMatches
        : isUploadingToShopify || !selectedProductId;
      const canShowUploadButton = isMultiProduct ? hasColorMatches : hasColorMatches;

      return (
      <Stack vertical spacing="base">
        {/* Drag & Drop Alanı */}
        <div
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
            if (files.length > 0) {
              handleImageUpload(files, productId);
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          style={{
            border: "2px dashed #c9cccf",
            borderRadius: "8px",
            padding: "2rem",
            textAlign: "center",
            backgroundColor: "#fafbfb",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#5c6ac4";
            e.currentTarget.style.backgroundColor = "#f6f6f7";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#c9cccf";
            e.currentTarget.style.backgroundColor = "#fafbfb";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.style.borderColor = "#5c6ac4";
            e.currentTarget.style.backgroundColor = "#e8f0fe";
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.style.borderColor = "#c9cccf";
            e.currentTarget.style.backgroundColor = "#fafbfb";
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.style.borderColor = "#c9cccf";
            e.currentTarget.style.backgroundColor = "#fafbfb";
            const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
            if (files.length > 0) {
              handleImageUpload(files, productId);
            }
          }}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.multiple = true;
            input.onchange = (e) => {
              const files = Array.from(e.target.files);
              if (files.length > 0) {
                handleImageUpload(files, productId);
              }
            };
            input.click();
          }}
        >
          <Stack vertical spacing="tight" alignment="center">
            <Text as="p" variant="headingSm">📁 Fotoğrafları buraya sürükleyin</Text>
            <Text as="p" variant="bodySm" color="subdued">veya tıklayarak seçin</Text>
            <Text as="p" variant="bodySm" color="subdued">
              JPG, PNG formatları desteklenir (çoklu seçim yapabilirsiniz)
            </Text>
          </Stack>
        </div>

        {/* Yüklenen Fotoğraflar Listesi */}
        {productImagesList.length > 0 && (
          <Stack vertical spacing="base">
            <Stack alignment="baseline" distribution="equalSpacing">
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                Yüklenen Fotoğraflar ({productImagesList.length})
              </Text>
              <Stack spacing="tight">
                <Button
                  size="slim"
                  onClick={analyzeHandler}
                  loading={isAnalyzingColors}
                  disabled={analyzeDisabled}
                >
                  {isAnalyzingColors ? "Analiz ediliyor..." : "🎨 Renklere Ayır"}
                </Button>
                
                {canShowUploadButton && (
                  <Button
                    size="slim"
                    primary
                    onClick={uploadHandler}
                    loading={isUploadingForProduct}
                    disabled={uploadDisabled}
                  >
                    {isUploadingForProduct 
                      ? "Yükleniyor..." 
                      : "📤 Ürün Fotoğraflarını Ekle"}
                  </Button>
                )}
              </Stack>
            </Stack>

            {/* Eşleştirme tamamlandı banner'ı - Multi product */}
            {hasColorMatches && !flowCompleted && (
              <Banner 
                status="success" 
                title="✅ Fotoğraflar renklere eşleştirildi!"
              >
                <Stack spacing="tight" alignment="center">
                  <Text as="span" variant="bodyMd">
                    Eşleştirmeler tamamlandı. Shopify'a yüklemek için yukarıdaki butona tıklayın.
                  </Text>
                  <Badge>{productImagesList.filter(img => img.colorMatch).length} fotoğraf hazır</Badge>
                </Stack>
              </Banner>
            )}

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: "1rem",
            }}>
              {productImagesList.map((img) => (
                <div
                  key={img.id}
                  style={{
                    position: "relative",
                    border: "2px solid #e1e3e5",
                    borderRadius: "8px",
                    padding: "8px",
                    backgroundColor: "#fff",
                  }}
                >
                  <img
                    src={img.preview}
                    alt="Preview"
                    style={{
                      width: "100%",
                      height: "150px",
                      objectFit: "cover",
                      borderRadius: "4px",
                    }}
                  />
                  <Button
                    size="slim"
                    plain
                    destructive
                    onClick={() => removeImage(img.id, productId)}
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                    }}
                  >
                    ✕
                  </Button>
                  
                  {/* Renk eşleştirmesi gösterimi */}
                  <div style={{ marginTop: "8px" }}>
                    {img.colorMatch ? (
                      <>
                        <Badge tone="success">{img.colorMatch}</Badge>
                        {(() => {
                          const summary = getVariantSummaryForColor(img.colorMatch);
                          if (!summary) return null;
                          return (
                            <Text as="p" variant="bodyXs" color="subdued" style={{ marginTop: 4 }}>
                              Bu görsel {summary.totalVariants} varyantta kullanılacak
                              {summary.sizesPreview
                                ? ` • Bedenler: ${summary.sizesPreview}${
                                    summary.moreSizesCount > 0 ? ` +${summary.moreSizesCount} beden` : ""
                                  }`
                                : ""}
                            </Text>
                          );
                        })()}
                      </>
                    ) : (
                      <Text as="p" variant="bodySm" color="subdued">
                        Renk atanmadı
                      </Text>
                    )}
                  </div>

                  {/* Manuel renk seçimi */}
                  {preview && preview.colors && preview.colors.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <Select
                        label=""
                        options={[
                          { label: "Renk seç...", value: "" },
                          ...preview.colors.map(color => ({ label: color, value: color })),
                        ]}
                        value={img.colorMatch || ""}
                        onChange={(value) => updateImageColorMatch(img.id, value, productId)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Stack>
        )}
      </Stack>
      );
    } catch (error) {
      console.error("renderProductImageSection hatası:", error);
      return (
        <Banner status="critical" title="Görsel bölümü yüklenirken hata oluştu">
          <Text as="p">{error.message}</Text>
        </Banner>
      );
    }
  };

  // Varyantları oluştur (çoklu ürün desteği ile)
  const handleCreate = async () => {
    // Çoklu mod aktifse selectedProductIds, değilse selectedProductId kullan
    const productIdsToProcess = useMultiSelect ? selectedProductIds : (selectedProductId ? [selectedProductId] : []);
    
    if (productIdsToProcess.length === 0) {
      setError("Lütfen en az bir ürün seçin");
      return;
    }

    if (!editableVariants || editableVariants.length === 0) {
      setError("Lütfen önce önizleme oluşturun ve en az bir varyant olduğundan emin olun");
      return;
    }

    // 🔴 100 VARYANT LİMİT KONTROLÜ (Son kontrol)
    if (editableVariants.length > SHOPIFY_LIMITS.MAX_VARIANTS_PER_PRODUCT) {
      setError(
        `⚠️ Shopify Limiti Aşıldı!\n\n` +
        `Oluşturmak istediğiniz varyant sayısı: ${editableVariants.length}\n` +
        `Shopify maksimum limiti: ${SHOPIFY_LIMITS.MAX_VARIANTS_PER_PRODUCT}\n\n` +
        `Lütfen bazı varyantları önizlemeden silin.`
      );
      return;
    }

    // 🔴 DUPLICATE VARYANT KONTROLÜ
    const variantKeys = new Set();
    const duplicates = [];
    for (const variant of editableVariants) {
      const key = `${variant.size}-${variant.color}`.toLowerCase();
      if (variantKeys.has(key)) {
        duplicates.push(`${variant.size} / ${variant.color}`);
      }
      variantKeys.add(key);
    }
    if (duplicates.length > 0) {
      setError(
        `⚠️ Aynı varyant kombinasyonu birden fazla kez var!\n\n` +
        `Tekrarlanan: ${duplicates.join(", ")}\n\n` +
        `Lütfen tekrarlanan varyantları silin.`
      );
      return;
    }

    // 🔴 FİYAT VE STOK DEĞER KONTROLÜ
    const invalidVariants = editableVariants.filter(v => {
      const price = parseFloat(v.price);
      const stock = parseInt(v.stock);
      return price < 0 || price > SHOPIFY_LIMITS.MAX_PRICE_VALUE || 
             stock < 0 || stock > SHOPIFY_LIMITS.MAX_STOCK_VALUE;
    });
    if (invalidVariants.length > 0) {
      setError(
        `⚠️ Geçersiz fiyat veya stok değeri!\n\n` +
        `Fiyat: 0 - ${SHOPIFY_LIMITS.MAX_PRICE_VALUE.toLocaleString()} arasında olmalı\n` +
        `Stok: 0 - ${SHOPIFY_LIMITS.MAX_STOCK_VALUE.toLocaleString()} arasında olmalı`
      );
      return;
    }

    // 🔴 API RATE LIMITING
    const now = Date.now();
    const timeSinceLastRequest = now - API_RATE_LIMIT.lastRequestTime;
    if (timeSinceLastRequest < API_RATE_LIMIT.MIN_INTERVAL_MS) {
      const waitTime = Math.ceil((API_RATE_LIMIT.MIN_INTERVAL_MS - timeSinceLastRequest) / 1000);
      setError(`⏱️ Çok hızlı! Lütfen ${waitTime} saniye bekleyin.`);
      return;
    }
    API_RATE_LIMIT.lastRequestTime = now;

    // 🔴 MEVCUT VARYANT UYARISI (Üzerine yazılacak mı?)
    const productsWithExistingVariants = productIdsToProcess
      .map(id => productsData?.products?.find(p => p.id === id))
      .filter(p => p && p.hasExistingVariants);
    
    if (productsWithExistingVariants.length > 0 && !showExistingVariantWarning) {
      // Toplam limit kontrolü
      const productsOverLimit = productsWithExistingVariants.filter(p => {
        const totalAfter = (p.variantsCount || 0) + editableVariants.length;
        return totalAfter > SHOPIFY_LIMITS.MAX_VARIANTS_PER_PRODUCT;
      });

      if (productsOverLimit.length > 0) {
        setError(
          `⚠️ Bazı ürünlerde 100 varyant limiti aşılacak!\n\n` +
          productsOverLimit.map(p => 
            `• ${p.title}: Mevcut ${p.variantsCount} + Yeni ${editableVariants.length} = ${p.variantsCount + editableVariants.length} (Limit: 100)`
          ).join('\n') +
          `\n\nLütfen bu ürünlerdeki mevcut varyantları silin veya daha az varyant oluşturun.`
        );
        return;
      }

      // Mevcut varyant uyarısı göster
      setExistingVariantInfo({
        products: productsWithExistingVariants,
        newVariantCount: editableVariants.length,
      });
      setShowExistingVariantWarning(true);
      return;
    }

    setError(null);
    setSuccess(null);
    setIsCreating(true);
    const totalVariants = editableVariants.length * productIdsToProcess.length;
    setCreationProgress({ current: 0, total: totalVariants });
    shopify.loading(true);

    const results = {
      success: [],
      errors: [],
      totalVariantsCreated: 0,
    };

    try {
      // Her ürün için varyantları oluştur
      for (let i = 0; i < productIdsToProcess.length; i++) {
        const productId = productIdsToProcess[i];
        const product = productsData?.products?.find(p => p.id === productId);
        const productName = product?.title || `Ürün ${i + 1}`;

        try {
          const endpoint = isDemoMode 
            ? `${apiBase}/variants/create` 
            : "/api/variants/create";
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: productId,
              editableVariants: editableVariants,
              basePrice: basePrice,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            results.errors.push({
              productId,
              productName,
              error: data.error || "Varyantlar oluşturulamadı",
            });
          } else {
            results.success.push({
              productId,
              productName,
              variantsCreated: data.variantsCreated || 0,
            });
            results.totalVariantsCreated += data.variantsCreated || 0;
          }
        } catch (err) {
          results.errors.push({
            productId,
            productName,
            error: `Hata: ${err.message}`,
          });
        }

        // Progress güncelle
        setCreationProgress({
          current: (i + 1) * editableVariants.length,
          total: totalVariants,
        });
      }

      // Sonuçları göster
      if (results.success.length > 0) {
        setVariantsLocked(true);
        setProductsReadyForImages((prev) => {
          const updated = { ...prev };
          results.success.forEach(({ productId }) => {
            updated[productId] = true;
          });
          return updated;
        });
        const baseSuccessText = productIdsToProcess.length > 1
          ? `${results.totalVariantsCreated} varyant ${results.success.length} ürüne başarıyla eklendi! 🎉`
          : `${results.totalVariantsCreated} varyant başarıyla oluşturuldu! 🎉`;
        const successMsg = `${baseSuccessText} Şimdi ürün fotoğraflarını ekleyebilirsiniz.`;
        setSuccess(successMsg);
        shopify.toast.show(successMsg, { duration: 5000 });
        
        // Geçmişe kaydet
        if (preview) {
          const historyData = {
            sizes: preview.sizes || [],
            colors: preview.colors || [],
            basePrice: preview.basePrice || basePrice,
            priceRules: preview.priceRules || [],
            stockRules: preview.stockRules || [],
            defaultStock: preview.defaultStock || null,
            variantCount: results.totalVariantsCreated || editableVariants.length,
          };
          const updatedHistory = saveToHistory(historyData);
          setHistory(updatedHistory);
        }
      }

      if (results.errors.length > 0) {
        const errorDetails = results.errors.map(e => `• ${e.productName}: ${e.error}`).join("\n");
        setError(
          `${results.errors.length} üründe hata oluştu:\n${errorDetails}`
        );
        shopify.toast.show("Bazı ürünlerde hata oluştu", { isError: true });
      }

      // Temizle
      if (results.errors.length === 0 || results.success.length > 0) {
        setPrompt("");
      }
      setCreationProgress(null);
      
      // Ürünleri yeniden yükle
      refetchProducts();
    } catch (err) {
      // Network hataları veya diğer beklenmeyen hatalar
      const isNetworkError = err.message.includes("Failed to fetch");
      const errorMsg = isNetworkError
        ? "Bağlantı hatası: Sunucuya erişilemiyor. Lütfen internet bağlantınızı kontrol edin."
        : `Varyantlar oluşturulurken bir hata oluştu: ${err.message}`;
      setError(errorMsg);
      shopify.toast.show(errorMsg, { isError: true });
      
      // Network hatası ise retry kuyruğuna ekle
      if (isNetworkError) {
        setPendingRetry({ type: 'create', data: {} });
      }
    } finally {
      setIsCreating(false);
      setCreationProgress(null);
      shopify.loading(false);
    }
  };

  // Ürün seçeneklerini hazırla
  const productOptions = productsData?.products
    ? [
        { label: "Ürün seçin...", value: "" },
        ...productsData.products.map((product) => ({
          label: product.title,
          value: product.id,
        })),
      ]
    : [{ label: "Ürün seçin...", value: "" }];


  const selectedProductReadyForImages = Boolean(
    selectedProductId && productsReadyForImages[selectedProductId]
  );

  console.log("VariantCreator component rendering...", { 
    useMultiSelect, 
    selectedProductIds: selectedProductIds.length,
    productImagesKeys: Object.keys(productImages)
  });

  return (
    <Page narrowWidth>
      {/* Global Animation Styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes successPop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkmark {
          0% { stroke-dashoffset: 50; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-100px) rotate(360deg); opacity: 0; }
        }
        .fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .fade-in-scale {
          animation: fadeInScale 0.25s ease-out forwards;
        }
        .btn-hover-effect {
          transition: all 0.2s ease;
        }
        .btn-hover-effect:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .btn-hover-effect:active {
          transform: translateY(0);
        }
        .card-hover {
          transition: all 0.2s ease;
        }
        .card-hover:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }
      `}</style>
      <TitleBar title={texts.app.title} />
      <Layout>
        <Layout.Section>
          {/* Demo Mode Banner */}
          {isDemoMode && (
            <Banner status="info" title="🎭 Demo Mode Aktif">
              <Text as="p" variant="bodyMd">
                Bu demo modunda çalışıyorsunuz. Gerçek Shopify mağazanıza değişiklik yapılmayacak. 
                Tüm işlemler simüle edilecek.
              </Text>
            </Banner>
          )}
          <Card sectioned>
            <Stack vertical spacing="loose">
              {/* Üst adım göstergesi - Kompakt ve Mobil uyumlu */}
              <div style={{ 
                marginBottom: "0.75rem", 
                width: "100%",
                padding: "8px 12px",
                backgroundColor: "#f6f6f7",
                borderRadius: "8px"
              }}>
                <div className="step-indicator-container" style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "4px"
                }}>
                  {stepItems.map((step, index) => {
                    const status = getStepStatus(step.id);
                    const isLast = index === stepItems.length - 1;
                    const bgColor =
                      status === "done" ? "#5c6ac4" : status === "current" ? "#2c6ecb" : "#d2d5d8";
                    const textColor = status === "upcoming" ? "#202223" : "#ffffff";
                    return (
                      <div key={step.id} style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : "1 1 0" }}>
                        <div
                          className="step-circle"
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "999px",
                            backgroundColor: bgColor,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: textColor,
                            fontSize: 11,
                            fontWeight: 600,
                            flexShrink: 0,
                            boxShadow: status === "current" ? "0 2px 8px rgba(44, 110, 203, 0.3)" : "none",
                            transition: "all 0.2s ease"
                          }}
                        >
                          {status === "done" ? "✓" : step.id + 1}
                        </div>
                        <span
                          className="step-label"
                          style={{ 
                            marginLeft: 4, 
                            whiteSpace: "nowrap", 
                            fontSize: "11px", 
                            lineHeight: "1.2",
                            fontWeight: status === "current" ? 600 : 400,
                            color: status === "upcoming" ? "#6d7175" : status === "current" ? "#2c6ecb" : "#202223"
                          }}
                        >
                          {step.label}
                        </span>
                        {!isLast && (
                          <div
                            className="step-connector"
                            style={{
                              flex: 1,
                              height: 2,
                              backgroundColor: currentStep > step.id ? "#5c6ac4" : "#e1e3e5",
                              marginLeft: 6,
                              marginRight: 6,
                              borderRadius: 999,
                              minWidth: 8,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Mobile Responsive Styles */}
                <style>{`
                  @media (max-width: 480px) {
                    .step-label {
                      display: none !important;
                    }
                    .step-circle {
                      width: 28px !important;
                      height: 28px !important;
                      font-size: 12px !important;
                    }
                    .step-connector {
                      min-width: 16px !important;
                      margin-left: 4px !important;
                      margin-right: 4px !important;
                    }
                  }
                  @media (max-width: 360px) {
                    .step-circle {
                      width: 24px !important;
                      height: 24px !important;
                    }
                  }
                `}</style>
              </div>
              <Text as="h2" variant="headingMd">
                Ürün Varyantlarını Otomatik Oluştur
              </Text>
              
              {/* Adım bazlı yardım metni */}
              {getStepHelpText(currentStep) && (
                <Banner status="info" title={`Adım ${currentStep + 1}: ${stepItems[currentStep]?.label}`}>
                  <Text as="p" variant="bodyMd">
                    {getStepHelpText(currentStep)}
                  </Text>
                  {currentStep === 0 && (
                    <div style={{ 
                      marginTop: "12px", 
                      padding: "12px 16px", 
                      background: "#fff3cd", 
                      border: "2px solid #ffc107",
                      borderRadius: "8px",
                      borderLeft: "4px solid #ff9800"
                    }}>
                      <Text as="p" variant="bodyMd" fontWeight="semibold" style={{ color: "#856404", marginBottom: "4px" }}>
                        ⚠️ Önemli: Ürün Gerekli
                      </Text>
                      <Text as="p" variant="bodySm" style={{ color: "#856404" }}>
                        Varyantları oluşturmak için önce mağazanıza en az bir ürün eklemeniz gerekmektedir.
                      </Text>
                    </div>
                  )}
                </Banner>
              )}

              {/* Çevrimdışı Uyarısı */}
              {isOffline && (
                <Banner 
                  status="warning" 
                  title="📡 İnternet Bağlantısı Yok"
                >
                  <Stack vertical spacing="tight">
                    <Text as="p" variant="bodyMd">
                      Çevrimdışı görünüyorsunuz. Bağlantı sağlandığında işlemleriniz otomatik olarak devam edecek.
                    </Text>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "8px",
                      padding: "8px 12px",
                      background: "rgba(255, 255, 255, 0.5)",
                      borderRadius: "6px",
                      marginTop: "4px"
                    }}>
                      <div style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#dc2626",
                        animation: "pulse 2s infinite"
                      }} />
                      <Text as="span" variant="bodySm" color="subdued">
                        Bağlantı bekleniyor...
                      </Text>
                    </div>
                  </Stack>
                </Banner>
              )}

              {/* Otomatik Retry Bildirimi */}
              {pendingRetry && !isOffline && retryCountdown > 0 && (
                <Banner 
                  status="info" 
                  title="🔄 Otomatik Yeniden Deneme"
                  onDismiss={cancelPendingRetry}
                >
                  <Stack vertical spacing="tight">
                    <Text as="p" variant="bodyMd">
                      {pendingRetry.type === 'preview' && "Önizleme işlemi"}
                      {pendingRetry.type === 'create' && "Varyant oluşturma işlemi"}
                      {pendingRetry.type === 'analyze' && "Renk analizi işlemi"}
                      {pendingRetry.type === 'upload' && "Görsel yükleme işlemi"}
                      {" "}{retryCountdown} saniye sonra tekrar denenecek...
                    </Text>
                    <Stack spacing="tight">
                      <Button size="slim" onClick={triggerManualRetry}>
                        Şimdi Dene
                      </Button>
                      <Button size="slim" plain onClick={cancelPendingRetry}>
                        İptal
                      </Button>
                    </Stack>
                  </Stack>
                </Banner>
              )}

              {/* Bekleyen İşlem Bildirimi (bağlantı kesilmişken) */}
              {pendingRetry && isOffline && (
                <Banner 
                  status="warning" 
                  title="⏳ Bekleyen İşlem"
                  onDismiss={cancelPendingRetry}
                >
                  <Stack vertical spacing="tight">
                    <Text as="p" variant="bodyMd">
                      {pendingRetry.type === 'preview' && "Önizleme işlemi"}
                      {pendingRetry.type === 'create' && "Varyant oluşturma işlemi"}
                      {pendingRetry.type === 'analyze' && "Renk analizi işlemi"}
                      {pendingRetry.type === 'upload' && "Görsel yükleme işlemi"}
                      {" "}bağlantı sağlandığında otomatik olarak tekrar denenecek.
                    </Text>
                    <Button size="slim" plain destructive onClick={cancelPendingRetry}>
                      İşlemi İptal Et
                    </Button>
                  </Stack>
                </Banner>
              )}

              {error && (
                <Banner 
                  status="critical" 
                  onDismiss={() => setError(null)}
                  title={
                    error.includes("Bağlantı hatası") || error.includes("fetch") ? "🌐 Bağlantı Sorunu" :
                    error.includes("rate limit") || error.includes("429") ? "⏱️ İşlem Limiti" :
                    error.includes("API") || error.includes("OpenAI") ? "⚙️ Servis Hatası" :
                    error.includes("Ürün") || error.includes("ürün") ? "📦 Ürün Hatası" :
                    error.includes("Prompt") || error.includes("prompt") ? "✏️ Prompt Hatası" :
                    "⚠️ Bir Sorun Oluştu"
                  }
                >
                  <Stack vertical spacing="tight">
                  <Text as="p" variant="bodyMd">
                    {error}
                  </Text>
                    
                    {/* Bağlantı hatası için yardım */}
                    {(error.includes("Bağlantı hatası") || error.includes("fetch") || error.includes("network")) && (
                      <div style={{ 
                        background: "#fff8e6", 
                        padding: "12px", 
                        borderRadius: "8px",
                        marginTop: "8px"
                      }}>
                        <Stack vertical spacing="extraTight">
                          <Text as="p" variant="bodySm" fontWeight="semibold">
                            💡 Çözüm Önerileri:
                    </Text>
                          <Text as="p" variant="bodySm" color="subdued">
                            • İnternet bağlantınızı kontrol edin
                          </Text>
                          <Text as="p" variant="bodySm" color="subdued">
                            • Sayfayı yenileyip tekrar deneyin
                          </Text>
                          <Text as="p" variant="bodySm" color="subdued">
                            • Sorun devam ederse 5 dakika bekleyin
                          </Text>
                        </Stack>
                      </div>
                    )}
                    
                    {/* Rate limit için yardım */}
                    {(error.includes("rate limit") || error.includes("429") || error.includes("çok fazla")) && (
                      <div style={{ 
                        background: "#fff8e6", 
                        padding: "12px", 
                        borderRadius: "8px",
                        marginTop: "8px"
                      }}>
                        <Text as="p" variant="bodySm">
                          💡 <strong>Çözüm:</strong> 30 saniye bekleyip "Tekrar Dene" butonuna tıklayın. Çok fazla istek gönderildiğinde bu hata oluşabilir.
                        </Text>
                      </div>
                    )}

                    {/* API / OpenAI hatası için yardım */}
                    {(error.includes("API") || error.includes("OpenAI") || error.includes("servis")) && (
                      <div style={{ 
                        background: "#fff8e6", 
                        padding: "12px", 
                        borderRadius: "8px",
                        marginTop: "8px"
                      }}>
                        <Stack vertical spacing="extraTight">
                          <Text as="p" variant="bodySm" fontWeight="semibold">
                            💡 Bu geçici bir sorun olabilir:
                          </Text>
                          <Text as="p" variant="bodySm" color="subdued">
                            • AI servisi şu anda yoğun olabilir
                          </Text>
                          <Text as="p" variant="bodySm" color="subdued">
                            • Birkaç dakika bekleyip tekrar deneyin
                          </Text>
                        </Stack>
                      </div>
                    )}
                    
                    {/* Prompt hatası için yardım */}
                    {(error.includes("Prompt") || error.includes("prompt") || error.includes("anlam")) && (
                      <div style={{ 
                        background: "#e6f4ea", 
                        padding: "12px", 
                        borderRadius: "8px",
                        marginTop: "8px"
                      }}>
                        <Stack vertical spacing="extraTight">
                          <Text as="p" variant="bodySm" fontWeight="semibold">
                            💡 Doğru Prompt Yazımı:
                          </Text>
                          <Text as="p" variant="bodySm" color="subdued">
                            • Bedenler: "S'den XL'e kadar" veya "M, L, XL"
                          </Text>
                          <Text as="p" variant="bodySm" color="subdued">
                            • Renkler: "kırmızı mavi yeşil" veya "kırmızı, beyaz, siyah"
                          </Text>
                          <Text as="p" variant="bodySm" color="subdued">
                            • Fiyat: "fiyat 200 lira" veya "temel fiyat 500 TL"
                          </Text>
                        </Stack>
                      </div>
                    )}

                    {/* Ürün hatası için yardım */}
                    {(error.includes("Ürün") || error.includes("ürün")) && (
                      <div style={{ 
                        background: "#fff8e6", 
                        padding: "12px", 
                        borderRadius: "8px",
                        marginTop: "8px"
                      }}>
                        <Text as="p" variant="bodySm">
                          💡 <strong>Çözüm:</strong> Lütfen yukarıdan bir ürün seçtiğinizden emin olun. Ürün listesi boşsa, önce Shopify'a ürün eklemeniz gerekir.
                        </Text>
                      </div>
                    )}
                    
                    {/* Aksiyon butonları */}
                    <Stack spacing="tight">
                      <Button 
                        size="slim" 
                        onClick={() => setError(null)}
                      >
                        Kapat
                      </Button>
                      {/* Retry için uygun hatalar */}
                      {(error.includes("Bağlantı") || 
                        error.includes("rate limit") || 
                        error.includes("429") ||
                        error.includes("fetch") ||
                        error.includes("API") ||
                        error.includes("OpenAI") ||
                        error.includes("network") ||
                        error.includes("timeout")) && (
                        <Button 
                          size="slim" 
                          primary
                          onClick={() => {
                            setError(null);
                            if (prompt) handlePreview();
                          }}
                        >
                          🔄 Tekrar Dene
                        </Button>
                      )}
                      {/* Ürün listesini yenile */}
                      {(error.includes("Ürün") || error.includes("ürün")) && (
                        <Button 
                          size="slim" 
                          primary
                          onClick={() => {
                            setError(null);
                            refetchProducts();
                          }}
                        >
                          🔄 Ürünleri Yenile
                        </Button>
                      )}
                      {/* Örnek prompt göster */}
                      {(error.includes("Prompt") || error.includes("prompt")) && (
                        <Button 
                          size="slim" 
                          primary
                          onClick={() => {
                            setError(null);
                            setShowPromptExamples(true);
                          }}
                        >
                          📝 Örnekleri Gör
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Banner>
              )}

              {success && (
                <Banner 
                  status="success" 
                  onDismiss={() => setSuccess(null)}
                  title={texts.success.title}
                >
                  <Stack vertical spacing="tight">
                  <Text as="p" variant="bodyMd">
                    {success}
                  </Text>
                    {success.includes("varyant") && success.includes("oluşturuldu") && (
                      <Text as="p" variant="bodySm" color="subdued">
                        ✨ Harika! Şimdi ürün fotoğraflarını ekleyerek varyantları tamamlayabilirsiniz.
                      </Text>
                    )}
                    {success.includes("yüklendi") && success.includes("Shopify") && (
                      <Text as="p" variant="bodySm" color="subdued">
                        🛍️ Mükemmel! Ürününüz artık mağazanızda hazır.
                      </Text>
                    )}
                  </Stack>
                </Banner>
              )}

              {isCreating && creationProgress && (
                <Card sectioned>
                  <div style={{ 
                    padding: "24px",
                    background: "linear-gradient(135deg, #e6f4ff 0%, #f0f7ff 100%)",
                    borderRadius: "12px"
                  }}>
                    <Stack vertical spacing="loose">
                      <Stack alignment="center" spacing="tight">
                        <div style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #0070f3 0%, #00a0dc 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 4px 16px rgba(0, 112, 243, 0.3)"
                        }}>
                          <span style={{ fontSize: "24px" }}>⚙️</span>
                        </div>
                        <div>
                          <Text as="h3" variant="headingMd">
                            Varyantlar Oluşturuluyor
                          </Text>
                          <Text as="p" variant="bodySm" color="subdued">
                      {useMultiSelect && selectedProductIds.length > 1
                              ? `${selectedProductIds.length} ürün için işlem yapılıyor`
                              : `${creationProgress.total} varyant Shopify'a ekleniyor`}
                    </Text>
                        </div>
                      </Stack>

                      {/* Progress Bar */}
                      <div style={{ width: "100%" }}>
                        <div style={{ 
                          display: "flex", 
                          justifyContent: "space-between", 
                          marginBottom: "8px" 
                        }}>
                          <Text as="span" variant="bodySm" color="subdued">İlerleme</Text>
                          <Text as="span" variant="bodySm" fontWeight="semibold">
                            {creationProgress.current || 0} / {creationProgress.total}
                          </Text>
                        </div>
                        <div style={{
                          width: "100%",
                          height: "12px",
                          background: "#e1e3e5",
                          borderRadius: "6px",
                          overflow: "hidden"
                        }}>
                          <div style={{
                            width: `${Math.min(100, ((creationProgress.current || 0) / creationProgress.total) * 100)}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, #0070f3 0%, #00a0dc 100%)",
                            borderRadius: "6px",
                            transition: "width 0.3s ease",
                            animation: "progressShine 1.5s ease-in-out infinite"
                          }} />
                        </div>
                      </div>

                      <Stack alignment="center" spacing="tight">
                      <Spinner size="small" />
                      <Text as="span" variant="bodySm" color="subdued">
                        {useMultiSelect && selectedProductIds.length > 1
                            ? "Toplu işlem birkaç dakika sürebilir..."
                            : "Bu işlem birkaç saniye sürecek..."}
                      </Text>
                    </Stack>

                      {/* Tip */}
                      <div style={{
                        background: "rgba(255, 255, 255, 0.7)",
                        padding: "12px",
                        borderRadius: "8px",
                        marginTop: "8px"
                      }}>
                        <Text as="p" variant="bodySm" color="subdued">
                          💡 <strong>İpucu:</strong> İşlem tamamlandığında otomatik olarak bir sonraki adıma geçilecek.
                        </Text>
                      </div>
                  </Stack>

                    <style>{`
                      @keyframes progressShine {
                        0% { opacity: 1; }
                        50% { opacity: 0.8; }
                        100% { opacity: 1; }
                      }
                    `}</style>
                  </div>
                </Card>
              )}

              {/* Hata durumunda hata mesajı göster */}
              {productsData?.error && !isLoadingProducts && (
                <Card sectioned>
                  <Banner status="critical" title="Ürünler yüklenemedi">
                    <Text as="p" variant="bodySm">
                      {productsData.error}
                    </Text>
                    <div style={{ marginTop: "12px" }}>
                      <Button onClick={() => refetchProducts()}>
                        🔄 Tekrar Dene
                      </Button>
                    </div>
                  </Banner>
                </Card>
              )}

              {/* Ürün yoksa ve hata yoksa ve loading bitmişse ve gerçekten ürün yoksa "ürün ekle" mesajı göster */}
              {!productsData?.error && 
               !isLoadingProducts &&
               productsData !== undefined &&
               productsData !== null &&
               Array.isArray(productsData.products) &&
               productsData.products.length === 0 && (
                  <Card sectioned>
                    <div style={{ 
                      textAlign: "center", 
                      padding: "40px 20px",
                      background: "linear-gradient(135deg, #f6f8fa 0%, #eef1f5 100%)",
                      borderRadius: "12px"
                    }}>
                      <div style={{ fontSize: "48px", marginBottom: "16px" }}>📦</div>
                      <Text as="h2" variant="headingLg">
                        Henüz ürün bulunamadı
                    </Text>
                      <div style={{ marginTop: "12px", marginBottom: "20px" }}>
                        <Text as="p" variant="bodyMd" color="subdued">
                          Varyant oluşturmak için önce mağazanıza en az bir ürün eklemeniz gerekmektedir.
                        </Text>
                      </div>
                      <div style={{ 
                        background: "#fff", 
                        padding: "16px", 
                        borderRadius: "8px", 
                        marginBottom: "20px",
                        border: "1px solid #e1e3e5"
                      }}>
                        <Text as="p" variant="bodySm" color="subdued">
                          <strong>Nasıl yapılır?</strong><br />
                          Shopify Admin → Ürünler → Ürün Ekle
                        </Text>
                      </div>
                      <Button
                        primary
                        url="https://admin.shopify.com/store/products/new"
                        external
                      >
                        Shopify'da Ürün Ekle
                      </Button>
                      <div style={{ marginTop: "12px" }}>
                        <Button
                          plain
                          onClick={() => refetchProducts()}
                        >
                          🔄 Ürünleri yenile
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

              {/* Çoklu seçim modu toggle */}
              <Stack>
                <Checkbox
                  label="Birden fazla ürün seç (Toplu işlem)"
                  checked={useMultiSelect}
                  onChange={(checked) => {
                    setUseMultiSelect(checked);
                    if (checked) {
                      // Çoklu moda geçerken, tek seçili ürünü çoklu listeye ekle
                      if (selectedProductId) {
                        setSelectedProductIds([selectedProductId]);
                        setSelectedProductId("");
                      }
                    } else {
                      // Tek moda geçerken, ilk seçili ürünü tek seçime al
                      if (selectedProductIds.length > 0) {
                        setSelectedProductId(selectedProductIds[0]);
                        setSelectedProductIds([]);
                      }
                    }
                  }}
                  disabled={isCreating}
                />
              </Stack>

              {!useMultiSelect ? (
                <Select
                  label="Ürün"
                  options={productOptions}
                  value={selectedProductId}
                  onChange={setSelectedProductId}
                  disabled={
                    isCreating ||
                    (productsData?.products &&
                      productsData.products.length === 0)
                  }
                  helpText={
                    (isLoadingProducts || isFetchingProducts)
                      ? "Ürünler yükleniyor..." 
                      : (productsData && Array.isArray(productsData.products) && productsData.products.length === 0 && !productsData.error)
                        ? "Henüz ürün bulunamadı. Lütfen önce ürün ekleyin."
                        : productsData?.error
                        ? `Hata: ${productsData.error}`
                        : undefined
                  }
                />
              ) : (
                <Card sectioned>
                  <Stack vertical spacing="base">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Ürünler ({selectedProductIds.length} / {SHOPIFY_LIMITS.MAX_PRODUCTS_SELECTION} seçili)
                    </Text>
                    <Text as="p" variant="bodySm" color="subdued">
                      Aynı varyant kombinasyonunu birden fazla ürüne uygulamak için ürünleri seçin
                    </Text>
                    {selectedProductIds.length >= SHOPIFY_LIMITS.MAX_PRODUCTS_SELECTION && (
                      <Banner status="warning" title="Maksimum Limit">
                        <Text as="p" variant="bodySm">
                          Maksimum {SHOPIFY_LIMITS.MAX_PRODUCTS_SELECTION} ürün seçebilirsiniz. Daha fazla ürün seçmek için bazı seçimleri kaldırın.
                        </Text>
                      </Banner>
                    )}
                    {selectedProductIds.length >= SHOPIFY_LIMITS.MAX_PRODUCTS_SELECTION * 0.8 && selectedProductIds.length < SHOPIFY_LIMITS.MAX_PRODUCTS_SELECTION && (
                      <Banner status="info" title="Limit Yaklaşıyor">
                        <Text as="p" variant="bodySm">
                          {SHOPIFY_LIMITS.MAX_PRODUCTS_SELECTION - selectedProductIds.length} ürün daha seçebilirsiniz.
                        </Text>
                      </Banner>
                    )}
                    <Stack vertical spacing="base">
                      {productsData?.products && productsData.products.length > 0 ? (
                        productsData.products.map((product) => {
                          const isSelected = selectedProductIds.includes(product.id);
                          const isAtLimit = !isSelected && selectedProductIds.length >= SHOPIFY_LIMITS.MAX_PRODUCTS_SELECTION;
                          
                          return (
                            <Checkbox
                              key={product.id}
                              label={product.title}
                              checked={isSelected}
                              onChange={(checked) => {
                                if (checked) {
                                  // Limit kontrolü
                                  if (selectedProductIds.length >= SHOPIFY_LIMITS.MAX_PRODUCTS_SELECTION) {
                                    setError(
                                      `⚠️ Maksimum Ürün Limiti Aşıldı!\n\n` +
                                      `Seçili ürün sayısı: ${selectedProductIds.length}\n` +
                                      `Maksimum limit: ${SHOPIFY_LIMITS.MAX_PRODUCTS_SELECTION} ürün\n\n` +
                                      `Lütfen bazı ürünlerin seçimini kaldırın.`
                                    );
                                    return;
                                  }
                                  setSelectedProductIds([...selectedProductIds, product.id]);
                                  setError(null); // Başarılı seçimde hata mesajını temizle
                                } else {
                                  setSelectedProductIds(selectedProductIds.filter(id => id !== product.id));
                                  setError(null); // Seçim kaldırıldığında hata mesajını temizle
                                }
                              }}
                              disabled={isCreating || isAtLimit}
                            />
                          );
                        })
                      ) : (
                        <Text as="p" variant="bodySm" color="subdued">
                          Ürün bulunamadı
                        </Text>
                      )}
                    </Stack>
                    {selectedProductIds.length > 0 && (
                      <Button
                        size="slim"
                        plain
                        onClick={() => setSelectedProductIds([])}
                      >
                        Tümünü temizle
                      </Button>
                    )}
                  </Stack>
                </Card>
              )}

              {/* Loading state'i kaldır - direkt ürün listesi veya "ürün yok" mesajı göster */}
              {/* Ürünler arka planda yüklenirken bile app kullanılabilir */}

              {/* Template'ler - Kompakt buton olarak */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <Button
                  size="slim"
                        onClick={() => setShowTemplates(!showTemplates)}
                        ariaExpanded={showTemplates}
                        ariaControls="templates-section"
                  icon={showTemplates ? "▼" : "▶"}
                >
                  📁 Şablonlar ({templates.length})
                      </Button>
                <Button
                  size="slim"
                  onClick={() => setShowHistory(!showHistory)}
                  ariaExpanded={showHistory}
                  ariaControls="history-section"
                >
                  📚 Geçmiş ({history.length})
                </Button>
              </div>
              
              {/* Şablonlar Collapsible */}
                    <Collapsible
                      open={showTemplates}
                      id="templates-section"
                      transition={{ duration: "200ms", timingFunction: "ease-in-out" }}
                    >
                <div style={{ 
                  backgroundColor: "#f9fafb", 
                  borderRadius: "8px", 
                  padding: "12px",
                  marginTop: "8px"
                }}>
                  {templates.length > 0 ? (
                      <Stack vertical spacing="tight">
                          {templates.map((template) => {
                            const sizesText = template.sizes?.join(", ") || "Belirtilmemiş";
                            const colorsText = template.colors?.join(", ") || "Belirtilmemiş";
                            return (
                          <div 
                            key={template.id}
                            className="template-card"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              backgroundColor: "#fff",
                              padding: "10px 12px",
                              borderRadius: "6px",
                              border: "1px solid #e1e3e5",
                              gap: "8px",
                              flexWrap: "wrap",
                              transition: "all 0.2s ease",
                              cursor: "pointer"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                              e.currentTarget.style.borderColor = "#c9cccf";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = "none";
                              e.currentTarget.style.borderColor = "#e1e3e5";
                            }}
                          >
                            <div style={{ flex: 1, minWidth: "150px" }}>
                              <Text as="p" variant="bodySm" fontWeight="semibold">
                                        {template.name}
                                      </Text>
                              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                                <Badge size="small">{sizesText}</Badge>
                                <Badge size="small">{colorsText}</Badge>
                                {template.basePrice && <Badge size="small">₺{template.basePrice}</Badge>}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "6px" }}>
                                    <Button
                                size="slim"
                                      primary
                                      onClick={() => useTemplate(template)}
                                      disabled={isCreating || isLoadingPreview}
                                    >
                                Kullan
                                    </Button>
                                    <Button
                                size="slim"
                                      destructive
                                plain
                                      onClick={() => removeTemplate(template.id)}
                                    >
                                Sil
                                    </Button>
                            </div>
                          </div>
                            );
                          })}
                        </Stack>
                  ) : (
                    <Text as="p" variant="bodySm" color="subdued" alignment="center">
                      Henüz şablon yok. Varyant oluşturduktan sonra kaydedin.
                    </Text>
                  )}
                </div>
              </Collapsible>

              {/* Geçmiş Kayıtlar Collapsible */}
                    <Collapsible
                      open={showHistory}
                      id="history-section"
                      transition={{ duration: "200ms", timingFunction: "ease-in-out" }}
                    >
                <div style={{ 
                  backgroundColor: "#f9fafb", 
                  borderRadius: "8px", 
                  padding: "12px",
                  marginTop: "8px"
                }}>
                  {history.length > 0 ? (
                        <Stack vertical spacing="tight">
                      {history.slice(0, 5).map((item) => {
                        const sizesText = item.sizes?.join(", ") || "Belirtilmemiş";
                        const colorsText = item.colors?.join(", ") || "Belirtilmemiş";
                        const date = new Date(item.timestamp);
                        const formattedDate = date.toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        return (
                          <div
                            key={item.id}
                            className="history-card"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              backgroundColor: "#fff",
                              padding: "10px 12px",
                              borderRadius: "6px",
                              border: "1px solid #e1e3e5",
                              gap: "8px",
                              flexWrap: "wrap",
                              transition: "all 0.2s ease",
                              cursor: "pointer"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                              e.currentTarget.style.borderColor = "#c9cccf";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = "none";
                              e.currentTarget.style.borderColor = "#e1e3e5";
                            }}
                          >
                            <div style={{ flex: 1, minWidth: "150px" }}>
                              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                <Badge size="small">{sizesText}</Badge>
                                <Badge size="small">{colorsText}</Badge>
                                  {item.variantCount > 0 && (
                                  <Badge size="small">{item.variantCount} varyant</Badge>
                                  )}
                              </div>
                              <Text as="p" variant="bodySm" color="subdued" style={{ marginTop: "4px" }}>
                                  {formattedDate}
                                </Text>
                            </div>
                            <div style={{ display: "flex", gap: "6px" }}>
                                <Button
                                  size="slim"
                                  onClick={() => useHistoryItem(item)}
                                  disabled={isCreating || isLoadingPreview}
                                >
                                  Kullan
                                </Button>
                                <Button
                                  size="slim"
                                  plain
                                  destructive
                                  onClick={() => removeHistoryItem(item.id)}
                                >
                                  Sil
                                </Button>
                            </div>
                          </div>
                        );
                      })}
                        {history.length > 5 && (
                          <Text as="p" variant="bodySm" color="subdued" alignment="center">
                            ... ve {history.length - 5} kayıt daha
                          </Text>
                        )}
                      </Stack>
                  ) : (
                    <Text as="p" variant="bodySm" color="subdued" alignment="center">
                      Henüz geçmiş yok. Varyant oluşturdukça burada görünecek.
                    </Text>
                  )}
                </div>
              </Collapsible>

              <Stack vertical spacing="tight">
                <Stack alignment="baseline" distribution="equalSpacing">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    Varyant Açıklaması (Prompt)
                  </Text>
                  <Button
                    size="slim"
                    onClick={() => setShowPromptExamples(true)}
                    disabled={isCreating}
                  >
                    📝 Örnekler
                  </Button>
                </Stack>
                <TextField
                  value={prompt}
                  onChange={(value) => {
                    const MAX_PROMPT_LENGTH = 1000;
                    if (value.length > MAX_PROMPT_LENGTH) {
                      // 1000 karakteri geçerse hata mesajı göster ve yazmayı engelle
                      setError(
                        `⚠️ Prompt çok uzun!\n\n` +
                        `Mevcut: ${value.length} karakter\n` +
                        `Maksimum: ${MAX_PROMPT_LENGTH} karakter\n\n` +
                        `Lütfen prompt'unuzu kısaltın.`
                      );
                      // Sadece ilk 1000 karakteri al
                      setPrompt(value.substring(0, MAX_PROMPT_LENGTH));
                    } else {
                      // 1000 karakter altındaysa normal yazmaya izin ver
                      setError(null);
                      setPrompt(value);
                    }
                  }}
                  maxLength={1000}
                  placeholder="Örnek: S'den 3XL'e kadar tüm bedenler, kırmızı yeşil mavi sarı mor renkler, fiyat 500 lira, 2XL ve sonrası için fiyat +100 lira, her varyant için 10 adet stok"
                  multiline={4}
                  disabled={
                    isCreating ||
                    (productsData?.products &&
                      productsData.products.length === 0)
                  }
                  helpText="Ürününüz için hangi bedenler, renkler, fiyat kuralları ve stok bilgileri olacağını açıklayın. Örnek: 'S'den 3XL'e kadar kırmızı mavi renklerinde, fiyat 500 lira, 2XL için 5 adet stok'"
                />
              </Stack>

              {/* Prompt örnekleri modal */}
              <Modal
                open={showPromptExamples}
                onClose={() => setShowPromptExamples(false)}
                title="Prompt Örnekleri"
                primaryAction={{
                  content: "Kapat",
                  onAction: () => setShowPromptExamples(false),
                }}
              >
                <Modal.Section>
                  <Stack vertical spacing="loose">
                    {promptExamples.map((example, index) => (
                      <Card key={index} sectioned>
                        <Stack vertical spacing="tight">
                          <Text as="p" variant="bodyMd" fontWeight="semibold">
                            {example.title}
                          </Text>
                          <Text as="p" variant="bodySm" color="subdued">
                            {example.text}
                          </Text>
                          <Button
                            size="slim"
                            onClick={() => {
                              setPrompt(example.text);
                              setShowPromptExamples(false);
                            }}
                          >
                            Bu Örneği Kullan
                          </Button>
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                </Modal.Section>
              </Modal>


              {/* Hızlı Fiyat Kuralları - Gizli */}
              {false && (
                <Card sectioned>
                  <Stack vertical spacing="tight">
                    <Text variant="bodyMd" fontWeight="semibold">
                      Hızlı Fiyat Kuralları
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      Tek tıkla fiyat kuralı ekleyin (prompt'a otomatik eklenir)
                    </Text>
                    <Stack spacing="tight" wrap>
                    <Button
                      size="slim"
                      onClick={() => {
                        const newRule = "XL ve üzeri bedenler için fiyat %10 artır";
                        setPrompt(prev => prev ? `${prev}, ${newRule}` : newRule);
                      }}
                      disabled={isCreating || isLoadingPreview}
                    >
                      XL+ %10 artır
                    </Button>
                    <Button
                      size="slim"
                      onClick={() => {
                        const newRule = "2XL ve üzeri bedenler için fiyat %15 artır";
                        setPrompt(prev => prev ? `${prev}, ${newRule}` : newRule);
                      }}
                      disabled={isCreating || isLoadingPreview}
                    >
                      2XL+ %15 artır
                    </Button>
                    <Button
                      size="slim"
                      onClick={() => {
                        const newRule = "3XL ve üzeri bedenler için fiyat %20 artır";
                        setPrompt(prev => prev ? `${prev}, ${newRule}` : newRule);
                      }}
                      disabled={isCreating || isLoadingPreview}
                    >
                      3XL+ %20 artır
                    </Button>
                    <Button
                      size="slim"
                      onClick={() => {
                        const newRule = "XL ve üzeri bedenler için fiyat %5 artır";
                        setPrompt(prev => prev ? `${prev}, ${newRule}` : newRule);
                      }}
                      disabled={isCreating || isLoadingPreview}
                    >
                      XL+ %5 artır
                    </Button>
                    <Button
                      size="slim"
                      onClick={() => {
                        const newRule = "XL ve üzeri bedenler için fiyat 50 lira artır";
                        setPrompt(prev => prev ? `${prev}, ${newRule}` : newRule);
                      }}
                      disabled={isCreating || isLoadingPreview}
                    >
                      XL+ +50₺
                    </Button>
                    <Button
                      size="slim"
                      onClick={() => {
                        const newRule = "2XL ve üzeri bedenler için fiyat 100 lira artır";
                        setPrompt(prev => prev ? `${prev}, ${newRule}` : newRule);
                      }}
                      disabled={isCreating || isLoadingPreview}
                    >
                      2XL+ +100₺
                    </Button>
                    <Button
                      size="slim"
                      onClick={() => {
                        const newRule = "S ve M bedenler için fiyat %5 azalt";
                        setPrompt(prev => prev ? `${prev}, ${newRule}` : newRule);
                      }}
                      disabled={isCreating || isLoadingPreview}
                    >
                      S/M %5 azalt
                    </Button>
                    <Button
                      size="slim"
                      onClick={() => {
                        const newRule = "Tüm bedenler için fiyat %10 artır";
                        setPrompt(prev => prev ? `${prev}, ${newRule}` : newRule);
                      }}
                      disabled={isCreating || isLoadingPreview}
                    >
                      Tümü %10 artır
                    </Button>
                  </Stack>
                </Stack>
              </Card>
              )}

              <Stack vertical spacing="tight">
              <Stack>
                <Button
                  onClick={() => handlePreview()}
                  disabled={
                    (!selectedProductId && (!useMultiSelect || selectedProductIds.length === 0)) ||
                    !prompt.trim() ||
                    isCreating ||
                    isLoadingPreview ||
                    (productsData?.products &&
                      productsData.products.length === 0)
                  }
                  loading={isLoadingPreview}
                >
                  Önizleme
                </Button>
                <Button
                  primary
                  onClick={handleCreate}
                  disabled={
                    (!selectedProductId && (!useMultiSelect || selectedProductIds.length === 0)) ||
                    !editableVariants ||
                    editableVariants.length === 0 ||
                    isCreating ||
                    variantsLocked ||
                    (productsData?.products &&
                      productsData.products.length === 0)
                  }
                  loading={isCreating}
                >
                  {useMultiSelect && selectedProductIds.length > 1 
                    ? `${selectedProductIds.length} Ürüne Varyantları Oluştur`
                    : "Varyantları Oluştur"}
                </Button>
                </Stack>
                {(!editableVariants || editableVariants.length === 0) && !isLoadingPreview && (
                  <Text as="p" variant="bodySm" color="subdued">
                    💡 Varyantları oluşturmak için önce "Önizleme" butonuna tıklayın.
                  </Text>
                )}
              </Stack>
            </Stack>
          </Card>
        </Layout.Section>

        {/* AI İşliyor Loading State - Gelişmiş Animasyonlu */}
        {isLoadingPreview && (
          <Layout.Section>
            <Card sectioned>
              <div style={{ 
                display: "flex", 
                flexDirection: "column", 
                alignItems: "center", 
                padding: "48px 24px",
                gap: "20px",
                background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
                borderRadius: "12px"
              }}>
                {/* Animated AI Icon */}
                <div style={{ position: "relative" }}>
                  <div style={{ 
                    width: "80px", 
                    height: "80px", 
                    borderRadius: "50%", 
                    background: "linear-gradient(135deg, #5C6AC4 0%, #00D4AA 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 8px 32px rgba(92, 106, 196, 0.3)",
                    animation: "aiPulse 2s ease-in-out infinite"
                  }}>
                    <span style={{ fontSize: "36px" }}>🤖</span>
                  </div>
                  {/* Rotating ring */}
                  <div style={{
                    position: "absolute",
                    top: "-8px",
                    left: "-8px",
                    width: "96px",
                    height: "96px",
                    border: "3px solid transparent",
                    borderTopColor: "#5C6AC4",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }} />
                </div>

                <Text as="h3" variant="headingLg" alignment="center">
                  ✨ AI Prompt'unuzu Analiz Ediyor
                </Text>
                
                {/* Progress steps */}
                <div style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: "12px",
                  width: "100%",
                  maxWidth: "300px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ 
                      width: "24px", 
                      height: "24px", 
                      borderRadius: "50%", 
                      background: "#008060",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "14px"
                    }}>✓</div>
                    <Text as="span" variant="bodySm" color="subdued">Prompt alındı</Text>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ 
                      width: "24px", 
                      height: "24px", 
                      borderRadius: "50%", 
                      background: "linear-gradient(135deg, #5C6AC4, #00D4AA)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      animation: "stepPulse 1s ease-in-out infinite"
                    }}>
                      <Spinner size="small" />
                    </div>
                    <Text as="span" variant="bodySm">AI analiz yapıyor...</Text>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", opacity: 0.5 }}>
                    <div style={{ 
                      width: "24px", 
                      height: "24px", 
                      borderRadius: "50%", 
                      background: "#e1e3e5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#8c9196",
                      fontSize: "12px"
                    }}>3</div>
                    <Text as="span" variant="bodySm" color="subdued">Varyantlar oluşturulacak</Text>
                  </div>
                </div>

                <Text as="p" variant="bodySm" color="subdued" alignment="center">
                  Bu işlem genellikle 2-5 saniye sürer
                </Text>

                {/* CSS Animations */}
                <style>{`
                  @keyframes aiPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                  }
                  @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                  @keyframes stepPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                  }
                `}</style>
              </div>
            </Card>
          </Layout.Section>
        )}

        {preview && (
          <Layout.Section>
            <Card sectioned>
              <Stack vertical spacing="loose">
                <Stack alignment="baseline" distribution="equalSpacing">
                  <Text as="h3" variant="headingMd">
                    Önizleme
                  </Text>
                  <Button
                    onClick={() => setShowSaveTemplateModal(true)}
                    icon="📋"
                  >
                    Şablon Olarak Kaydet
                  </Button>
                </Stack>

                {/* Sağda küçük özet kutusu */}
                <Stack alignment="start" distribution="equalSpacing">
                  <Stack>
                  {preview.sizes.length > 0 && (
                    <Stack.Item>
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        Bedenler:
                      </Text>
                      <Stack spacing="tight">
                        {preview.sizes.map((size) => (
                          <Badge key={size}>{size}</Badge>
                        ))}
                      </Stack>
                    </Stack.Item>
                  )}

                  {preview.colors.length > 0 && (
                    <Stack.Item>
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        Renkler:
                      </Text>
                      <Stack spacing="tight">
                        {preview.colors.map((color) => (
                          <Badge key={color}>{color}</Badge>
                        ))}
                      </Stack>
                    </Stack.Item>
                  )}
                </Stack>

                  <Card
                    sectioned
                    subdued
                    title="Özet"
                    style={{ 
                      minWidth: "auto",
                      maxWidth: "100%",
                      marginLeft: 0,
                      marginTop: "1rem"
                    }}
                  >
                    <Stack vertical spacing="tight">
                      <Text as="p" variant="bodySm" fontWeight="semibold">
                        Hızlı Özet
                      </Text>
                      <Text as="p" variant="bodySm" color="subdued">
                        Beden: {preview.sizes.length || 1} • Renk: {preview.colors.length || 1}
                      </Text>
                      <Text as="p" variant="bodySm" color="subdued">
                        Oluşturulacak varyant: {editableVariants.length} adet
                      </Text>
                      {editableVariants.length > 0 && (
                        <div
                          style={{
                            marginTop: "0.4rem",
                            padding: "0.6rem 0.9rem",
                            borderRadius: "999px",
                            background:
                              "linear-gradient(135deg, rgba(0, 128, 96, 0.1), rgba(0, 204, 150, 0.18))",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.45rem",
                          }}
                        >
                          <span
                            role="img"
                            aria-label="Zaman kazancı"
                            style={{ fontSize: "1.1rem" }}
                          >
                            ⏱️
                          </span>
                          <div style={{ lineHeight: 1.3 }}>
                            <Text as="p" variant="bodySm" fontWeight="semibold" color="success">
                              Vay be! ~{Math.max(1, Math.round(editableVariants.length * 0.5))} dakika kazanıyorsun 😎
                            </Text>
                            <Text as="p" variant="bodySm" color="subdued">
                              Bu işi tek tek yapsaydın bu kadar zaman harcayacaktın.
                            </Text>
                          </div>
                        </div>
                      )}
                    </Stack>
                  </Card>
                </Stack>

                {preview.basePrice && (
                  <div>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Temel Fiyat: ₺{preview.basePrice}
                    </Text>
                  </div>
                )}

                {preview.priceRules && preview.priceRules.length > 0 && (
                  <div>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Fiyat Kuralları:
                    </Text>
                    <ul>
                      {preview.priceRules.map((rule, index) => (
                        <li key={index}>
                          {rule.condition}: {
                            rule.increase ? `+${rule.increase} TL` : 
                            rule.decrease ? `-${rule.decrease} TL` : 
                            rule.increasePercentage ? `+%${rule.increasePercentage}` :
                            rule.decreasePercentage ? `-%${rule.decreasePercentage}` :
                            ''
                          }
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.defaultStock && (
                  <div>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Varsayılan Stok: {preview.defaultStock} adet
                    </Text>
                  </div>
                )}

                {preview.stockRules && preview.stockRules.length > 0 && (
                  <div>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Stok Kuralları:
                    </Text>
                    <ul>
                      {preview.stockRules.map((rule, index) => (
                        <li key={index}>
                          {rule.condition}: {rule.quantity} adet
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <Stack alignment="baseline" distribution="equalSpacing">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Oluşturulacak Varyantlar: {editableVariants.length} adet
                    </Text>
                    {editableVariants.length > 0 && (
                      <Text as="p" variant="bodySm" color="subdued">
                        Düzenlemek için fiyat ve stok alanlarını değiştirebilir, silmek için ✕ butonuna tıklayabilirsiniz
                      </Text>
                    )}
                  </Stack>

                  {/* Tümüne Uygula Banner'ı */}
                  {showApplyAllBanner && lastEditedValue && !variantsLocked && (
                    <div style={{
                      background: "linear-gradient(135deg, #e6f4ff 0%, #f0f7ff 100%)",
                      border: "1px solid #b3d9ff",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      marginTop: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "12px"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "20px" }}>💡</span>
                        <Text as="span" variant="bodyMd">
                          <strong>{
                            lastEditedValue.type === 'price' ? 'Fiyat' : 
                            lastEditedValue.type === 'compareAtPrice' ? 'Karşılaştırma Fiyatı' : 'Stok'
                          }</strong> değerini{' '}
                          <strong>
                            {lastEditedValue.type === 'price' || lastEditedValue.type === 'compareAtPrice'
                              ? `₺${lastEditedValue.value}` 
                              : `${lastEditedValue.value} adet`}
                          </strong>{' '}
                          olarak değiştirdiniz. Tüm varyantlara uygulamak ister misiniz?
                        </Text>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button
                          primary
                          onClick={applyValueToAll}
                        >
                          ✓ Tümüne Uygula ({editableVariants.length} varyant)
                        </Button>
                        <Button
                          plain
                          onClick={dismissApplyAllBanner}
                        >
                          Hayır
                        </Button>
                      </div>
                    </div>
                  )}

                  {editableVariants.length > 0 && (
                    <>
                      {/* Desktop Table View */}
                      <div className="variant-table-desktop" style={{ marginTop: "1rem", overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "500px" }}>
                        <thead>
                            <tr style={{ borderBottom: "2px solid #e1e3e5", background: "#f9fafb" }}>
                              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "600", fontSize: "13px" }}>Beden</th>
                              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "600", fontSize: "13px" }}>Renk</th>
                              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "600", fontSize: "13px", width: "150px" }}>Fiyat (₺)</th>
                              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "600", fontSize: "13px", width: "150px" }}>Karşılaştırma (₺)</th>
                              <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "600", fontSize: "13px" }}>Stok</th>
                              <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: "600", fontSize: "13px", width: "60px" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                            {editableVariants.map((variant, index) => (
                              <tr 
                                key={variant.id} 
                                style={{ 
                                  borderBottom: "1px solid #e1e3e5",
                                  background: index % 2 === 0 ? "#fff" : "#fafbfc"
                                }}
                              >
                                <td style={{ padding: "8px 12px" }}>
                                <Badge>{variant.size}</Badge>
                              </td>
                                <td style={{ padding: "8px 12px" }}>
                                <Badge>{variant.color}</Badge>
                              </td>
                                <td style={{ padding: "8px 12px", width: "150px" }}>
                                <TextField
                                  type="number"
                                  value={variant.price}
                                  onChange={(value) => updateVariantPrice(variant.id, value)}
                                  prefix="₺"
                                  autoComplete="off"
                                  min="0"
                                step="0.01"
                                disabled={variantsLocked}
                                />
                              </td>
                                <td style={{ padding: "8px 12px", width: "150px" }}>
                                <TextField
                                  type="number"
                                  value={variant.compareAtPrice || ""}
                                  onChange={(value) => updateVariantCompareAtPrice(variant.id, value)}
                                  prefix="₺"
                                  placeholder="-"
                                  autoComplete="off"
                                  min="0"
                                  step="0.01"
                                  disabled={variantsLocked}
                                />
                              </td>
                                <td style={{ padding: "8px 12px" }}>
                                <TextField
                                  type="number"
                                  value={variant.stock.toString()}
                                  onChange={(value) => updateVariantStock(variant.id, value)}
                                  autoComplete="off"
                                  min="0"
                                disabled={variantsLocked}
                                />
                              </td>
                                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                <Button
                                  plain
                                  destructive
                                disabled={variantsLocked}
                                  onClick={() => deleteVariant(variant.id)}
                                  accessibilityLabel="Varyantı sil"
                                >
                                  ✕
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                      {/* Mobile Card View */}
                      <div className="variant-cards-mobile" style={{ display: "none", marginTop: "1rem" }}>
                        <Stack vertical spacing="tight">
                          {editableVariants.map((variant) => (
                            <div 
                              key={variant.id}
                              style={{
                                background: "#fff",
                                border: "1px solid #e1e3e5",
                                borderRadius: "8px",
                                padding: "12px"
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <Badge>{variant.size}</Badge>
                                  <Badge>{variant.color}</Badge>
                                </div>
                                <Button
                                  plain
                                  destructive
                                  disabled={variantsLocked}
                                  onClick={() => deleteVariant(variant.id)}
                                  accessibilityLabel="Varyantı sil"
                                >
                                  ✕
                                </Button>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                                <TextField
                                  label="Fiyat"
                                  type="number"
                                  value={variant.price}
                                  onChange={(value) => updateVariantPrice(variant.id, value)}
                                  prefix="₺"
                                  autoComplete="off"
                                  min="0"
                                  step="0.01"
                                  disabled={variantsLocked}
                                />
                                <TextField
                                  label="Karş. Fiyat"
                                  type="number"
                                  value={variant.compareAtPrice || ""}
                                  onChange={(value) => updateVariantCompareAtPrice(variant.id, value)}
                                  prefix="₺"
                                  placeholder="-"
                                  autoComplete="off"
                                  min="0"
                                  step="0.01"
                                  disabled={variantsLocked}
                                />
                                <TextField
                                  label="Stok"
                                  type="number"
                                  value={variant.stock !== undefined && variant.stock !== null ? variant.stock.toString() : ""}
                                  onChange={(value) => updateVariantStock(variant.id, value)}
                                  autoComplete="off"
                                  min="0"
                                  disabled={variantsLocked}
                                />
                              </div>
                            </div>
                          ))}
                        </Stack>
                      </div>

                      {/* Mobile responsive styles */}
                      <style>{`
                        @media (max-width: 600px) {
                          .variant-table-desktop {
                            display: none !important;
                          }
                          .variant-cards-mobile {
                            display: block !important;
                          }
                        }
                      `}</style>
                    </>
                  )}

                  {/* Toplu Ürün Seçimi: Önizleme Tablosunun Altında "Varyantları Oluştur" Butonu */}
                  {editableVariants.length > 0 && useMultiSelect && selectedProductIds.length > 0 && (
                    <div style={{ 
                      marginTop: "2rem", 
                      paddingTop: "1.5rem", 
                      borderTop: "2px solid #e1e3e5",
                      display: "flex",
                      justifyContent: "center"
                    }}>
                      <Button
                        primary
                        size="large"
                        onClick={handleCreate}
                        disabled={
                          selectedProductIds.length === 0 ||
                          editableVariants.length === 0 ||
                          isCreating ||
                          variantsLocked ||
                          (productsData?.products && productsData.products.length === 0)
                        }
                        loading={isCreating}
                      >
                        {isCreating 
                          ? `${selectedProductIds.length} Ürüne Varyantları Oluşturuluyor...`
                          : `${selectedProductIds.length} Ürüne Varyantları Oluştur`}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Görsel Yükleme Bölümü */}
                {preview && preview.colors && preview.colors.length > 0 && (
                  <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "2px solid #e1e3e5" }}>
                    {useMultiSelect && selectedProductIds.length > 0 ? (
                      // Çoklu seçim modu: Her ürün için accordion
                      <Stack vertical spacing="base">
                        <Text as="h3" variant="headingSm">
                          📸 Ürün Fotoğrafları
                        </Text>
                        <Text as="p" variant="bodySm" color="subdued">
                          Her ürün için fotoğrafları ayrı ayrı yükleyin. AI ile otomatik renk eşleştirmesi yapılacaktır.
                        </Text>

                        {selectedProductIds.map((productId) => {
                          const product = productsData?.products?.find(p => p.id === productId);
                          const productImagesList = productImages[productId] || [];
                          const isOpen = openProductSections[productId] || false;
                          const isReadyForImages = !!productsReadyForImages[productId];
                          
                          return (
                            <Card key={productId} sectioned>
                              <Stack vertical spacing="tight">
                                <Button
                                  plain
                                  onClick={() => setOpenProductSections(prev => ({
                                    ...prev,
                                    [productId]: !prev[productId]
                                  }))}
                                  ariaExpanded={isOpen}
                                >
                                  <Stack distribution="equalSpacing" alignment="center">
                                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                                      {product?.title || productId}
                                      {productImagesList.length > 0 && (
                                        <Badge tone="info" style={{ marginLeft: "8px" }}>
                                          {productImagesList.length} fotoğraf
                                        </Badge>
                                      )}
                                    </Text>
                                    <Text as="span" variant="bodySm">
                                      {isOpen ? "▲" : "▼"}
                                    </Text>
                                  </Stack>
                                </Button>

                                <Collapsible open={isOpen}>
                                  <div style={{ marginTop: "1rem" }}>
                                    {(() => {
                                      try {
                                        return renderProductImageSection(productId, productImagesList, isReadyForImages);
                                      } catch (error) {
                                        console.error("renderProductImageSection çağrı hatası:", error);
                                        return (
                                          <Banner status="critical" title="Hata">
                                            <Text as="p">{error.message}</Text>
                                          </Banner>
                                        );
                                      }
                                    })()}
                                  </div>
                                </Collapsible>
                              </Stack>
                            </Card>
                          );
                        })}
                      </Stack>
                    ) : (
                      // Tek seçim modu: Normal görsel yükleme
                      <div id="image-upload-section" style={{ position: "relative" }}>
                        {/* Yükleme Overlay */}
                        {isUploadingToShopify && (
                          <div style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: "rgba(255, 255, 255, 0.97)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 100,
                            borderRadius: "12px",
                            gap: "16px",
                            padding: "40px"
                          }}>
                            <div style={{
                              width: "80px",
                              height: "80px",
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, #008060 0%, #00a870 100%)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 8px 32px rgba(0, 128, 96, 0.3)",
                              animation: "uploadPulse 1.5s ease-in-out infinite"
                            }}>
                              <span style={{ fontSize: "36px" }}>📤</span>
                            </div>
                            <Text as="h3" variant="headingLg">
                              Shopify'a Yükleniyor...
                            </Text>
                            
                            {/* Yükleme Bilgisi */}
                            {uploadProgress.total > 0 && (
                              <div style={{
                                background: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                borderRadius: "8px",
                                padding: "12px 20px",
                                textAlign: "center"
                              }}>
                                <Text as="p" variant="headingMd" fontWeight="bold">
                                  📷 {uploadProgress.total} fotoğraf
                                </Text>
                                <Text as="p" variant="bodySm" color="subdued">
                                  varyantlara atanıyor
                                </Text>
                              </div>
                            )}

                            {/* Animated Progress Bar */}
                            <div style={{ width: "100%", maxWidth: "280px" }}>
                              <div style={{
                                width: "100%",
                                height: "10px",
                                background: "#e1e3e5",
                                borderRadius: "5px",
                                overflow: "hidden"
                              }}>
                                <div style={{
                                  width: "100%",
                                  height: "100%",
                                  background: "linear-gradient(90deg, #008060 0%, #00d4aa 50%, #008060 100%)",
                                  backgroundSize: "200% 100%",
                                  animation: "uploadProgress 1.2s ease-in-out infinite",
                                  borderRadius: "5px"
                                }} />
                              </div>
                            </div>

                            {/* İşlem Adımları */}
                            <div style={{ 
                              display: "flex", 
                              flexDirection: "column", 
                              gap: "8px",
                              marginTop: "8px"
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{
                                  width: "20px",
                                  height: "20px",
                                  borderRadius: "50%",
                                  background: "#008060",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "white",
                                  fontSize: "12px"
                                }}>✓</div>
                                <Text as="span" variant="bodySm" color="subdued">
                                  Fotoğraflar hazırlandı
                                </Text>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{
                                  width: "20px",
                                  height: "20px",
                                  borderRadius: "50%",
                                  background: "linear-gradient(135deg, #008060, #00d4aa)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}>
                                  <Spinner size="small" />
                                </div>
                                <Text as="span" variant="bodySm">
                                  Shopify'a yükleniyor...
                                </Text>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", opacity: 0.5 }}>
                                <div style={{
                                  width: "20px",
                                  height: "20px",
                                  borderRadius: "50%",
                                  background: "#e1e3e5",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#8c9196",
                                  fontSize: "10px"
                                }}>3</div>
                                <Text as="span" variant="bodySm" color="subdued">
                                  Varyantlara atanacak
                                </Text>
                              </div>
                            </div>

                            <Text as="p" variant="bodySm" color="subdued" style={{ marginTop: "8px" }}>
                              Bu işlem fotoğraf sayısına bağlı olarak biraz zaman alabilir
                            </Text>
                            <style>{`
                              @keyframes uploadPulse {
                                0%, 100% { transform: scale(1); }
                                50% { transform: scale(1.05); }
                              }
                              @keyframes uploadProgress {
                                0% { background-position: 200% 0; }
                                100% { background-position: -200% 0; }
                              }
                            `}</style>
                          </div>
                        )}

                        {/* Renk Analizi Overlay */}
                        {isAnalyzingColors && (
                          <div style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: "rgba(255, 255, 255, 0.95)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 100,
                            borderRadius: "12px",
                            gap: "20px",
                            padding: "40px"
                          }}>
                            <div style={{
                              width: "80px",
                              height: "80px",
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, #5C6AC4 0%, #9C6ADE 100%)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 8px 32px rgba(92, 106, 196, 0.3)",
                              animation: "colorPulse 1.5s ease-in-out infinite"
                            }}>
                              <span style={{ fontSize: "36px" }}>🎨</span>
                            </div>
                            <Text as="h3" variant="headingLg">
                              Renkler Analiz Ediliyor...
                            </Text>
                            <div style={{ display: "flex", gap: "8px" }}>
                              {["#E53935", "#1E88E5", "#43A047", "#FDD835", "#8E24AA"].map((color, i) => (
                                <div 
                                  key={i}
                                  style={{
                                    width: "24px",
                                    height: "24px",
                                    borderRadius: "50%",
                                    background: color,
                                    animation: `colorBounce 0.6s ease-in-out ${i * 0.1}s infinite`
                                  }}
                                />
                              ))}
                            </div>
                            <Text as="p" variant="bodySm" color="subdued">
                              AI fotoğrafları renklere göre eşleştiriyor...
                            </Text>
                            <style>{`
                              @keyframes colorPulse {
                                0%, 100% { transform: scale(1); }
                                50% { transform: scale(1.05); }
                              }
                              @keyframes colorBounce {
                                0%, 100% { transform: translateY(0); }
                                50% { transform: translateY(-8px); }
                              }
                            `}</style>
                          </div>
                        )}

                        <Stack vertical spacing="base">
                          <Stack alignment="baseline" distribution="equalSpacing">
                            <Text as="h3" variant="headingSm">
                              📸 Ürün Fotoğrafları
                            </Text>
                          {selectedProductReadyForImages && uploadedImages.length > 0 && (
                            <Badge>{uploadedImages.length} fotoğraf</Badge>
                          )}
                        </Stack>
                        <Text as="p" variant="bodySm" color="subdued">
                          Renk varyantları için fotoğrafları yükleyin. AI ile otomatik renk eşleştirmesi yapılacaktır.
                        </Text>

                        {!selectedProductReadyForImages && (
                          <Stack vertical spacing="tight">
                            <div>
                              <Button
                                primary
                                onClick={handleCreate}
                                disabled={
                                  (!selectedProductId && (!useMultiSelect || selectedProductIds.length === 0)) ||
                                  !editableVariants ||
                                  editableVariants.length === 0 ||
                                  isCreating ||
                                  variantsLocked ||
                                  (productsData?.products && productsData.products.length === 0)
                                }
                                loading={isCreating}
                              >
                                {useMultiSelect && selectedProductIds.length > 1
                                  ? `${selectedProductIds.length} Ürüne Varyantları Oluştur`
                                  : "Varyantları Oluştur"}
                              </Button>
                              {(!selectedProductId && (!useMultiSelect || selectedProductIds.length === 0)) && (
                                <Text as="p" variant="bodySm" color="critical" tone="subdued">
                                  Lütfen önce yukarıdan bir ürün seçimi yapınız.
                                </Text>
                              )}
                            </div>
                            <Banner status="warning" title="Önce varyantları oluşturun">
                              <Text as="p" variant="bodySm">
                                Fotoğrafları yüklemeden önce seçili ürün için varyantları oluşturmalısınız.
                              </Text>
                            </Banner>
                          </Stack>
                        )}

                        {selectedProductReadyForImages && (
                          <>
                            {/* Drag & Drop Alanı */}
                            <div
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.currentTarget.style.borderColor = "#c9cccf";
                                e.currentTarget.style.backgroundColor = "#fafbfb";
                                const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
                                if (files.length > 0) {
                                  handleImageUpload(files);
                                }
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.currentTarget.style.borderColor = "#5c6ac4";
                                e.currentTarget.style.backgroundColor = "#e8f0fe";
                              }}
                              onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.currentTarget.style.borderColor = "#c9cccf";
                                e.currentTarget.style.backgroundColor = "#fafbfb";
                              }}
                              style={{
                                border: "2px dashed #c9cccf",
                                borderRadius: "8px",
                                padding: "2rem",
                                textAlign: "center",
                                backgroundColor: "#fafbfb",
                                cursor: "pointer",
                                transition: "all 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "#5c6ac4";
                                e.currentTarget.style.backgroundColor = "#f6f6f7";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "#c9cccf";
                                e.currentTarget.style.backgroundColor = "#fafbfb";
                              }}
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.multiple = true;
                                input.onchange = (e) => {
                                  const files = Array.from(e.target.files);
                                  if (files.length > 0) {
                                    handleImageUpload(files);
                                  }
                                };
                                input.click();
                              }}
                            >
                              <Stack vertical spacing="tight" alignment="center">
                                <Text as="p" variant="headingSm">📁 Fotoğrafları buraya sürükleyin</Text>
                                <Text as="p" variant="bodySm" color="subdued">veya tıklayarak seçin</Text>
                                <Text as="p" variant="bodySm" color="subdued">
                                  JPG, PNG formatları desteklenir (çoklu seçim yapabilirsiniz)
                                </Text>
                              </Stack>
                            </div>

                            {/* Yüklenen Fotoğraflar Listesi */}
                            {uploadedImages.length > 0 && (
                              <Stack vertical spacing="base">
                                <Stack alignment="baseline" distribution="equalSpacing">
                                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                                    Yüklenen Fotoğraflar
                                  </Text>
                                  <Stack spacing="tight">
                                    <Button
                                      size="slim"
                                      onClick={handleAnalyzeColors}
                                      loading={isAnalyzingColors}
                                      disabled={isAnalyzingColors || !preview || !preview.colors || preview.colors.length === 0}
                                    >
                                      {isAnalyzingColors ? "Analiz ediliyor..." : "🎨 Renklere Ayır"}
                                    </Button>
                                    
                                    {/* Ürün fotoğraflarını Shopify'a ekle butonu - Tek seçim modu için */}
                                    {!useMultiSelect && uploadedImages.some(img => img.colorMatch) && (
                                      <Stack spacing="tight">
                                        <Button
                                          size="slim"
                                          primary
                                          onClick={() => handleUploadImagesToShopify()}
                                          loading={isUploadingToShopify}
                                          disabled={
                                            isUploadingToShopify ||
                                            !selectedProductId
                                          }
                                        >
                                          {isUploadingToShopify ? "Yükleniyor..." : "📤 Ürün Fotoğraflarını Ekle"}
                                        </Button>
                                        {flowCompleted && lastUploadStats?.productId && (
                                          <Button
                                            size="slim"
                                            onClick={() => {
                                              try {
                                                const rawId = lastUploadStats.productId;
                                                const numericId = rawId.split("/").pop();
                                                if (!numericId) return;

                                                // Shopify admin sayfasına yönlendirme için /exitiframe route'unu kullan
                                                if (shopDomain) {
                                                  const targetUrl = `https://${shopDomain}/admin/products/${numericId}`;
                                                  const redirectUri = encodeURIComponent(targetUrl);
                                                  window.location.href = `/exitiframe?redirectUri=${redirectUri}`;
                                                } else {
                                                  console.warn("Shop domain bulunamadı, ürüne yönlendirilemedi");
                                                }
                                              } catch (e) {
                                                console.error("Ürün sayfasına giderken hata:", e);
                                              }
                                            }}
                                          >
                                            Ürüne git
                                          </Button>
                                        )}
                                      </Stack>
                                    )}
                                  </Stack>
                                </Stack>

                                {/* Eşleştirme tamamlandı banner'ı */}
                                {!useMultiSelect && uploadedImages.some(img => img.colorMatch) && !flowCompleted && (
                                  <Banner 
                                    status="success" 
                                    title="✅ Fotoğraflar renklere başarıyla eşleştirildi!"
                                  >
                                    <Stack vertical spacing="tight">
                                      <Text as="p" variant="bodyMd">
                                        Eşleştirmeler tamamlandı. Şimdi fotoğrafları Shopify'a yükleyebilirsiniz.
                                      </Text>
                                      <Stack spacing="tight">
                                        <Button
                                          primary
                                          onClick={() => handleUploadImagesToShopify()}
                                          loading={isUploadingToShopify}
                                          disabled={isUploadingToShopify || !selectedProductId}
                                        >
                                          {isUploadingToShopify ? "Yükleniyor..." : "📤 Ürün Fotoğraflarını Ekle"}
                                        </Button>
                                        <Text as="span" variant="bodySm" color="subdued">
                                          {uploadedImages.filter(img => img.colorMatch).length} fotoğraf eşleştirildi
                                        </Text>
                                      </Stack>
                                    </Stack>
                                  </Banner>
                                )}

                                {/* Sıralama ipucu */}
                                {uploadedImages.some(img => img.colorMatch) && (
                                <div style={{
                                    background: "#FFF8E6", 
                                    padding: "10px 14px", 
                                    borderRadius: "8px",
                                    marginBottom: "12px",
                                    border: "1px solid #FFD79D"
                                  }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                                      <span style={{ fontSize: "18px" }}>💡</span>
                                      <div>
                                        <Text as="span" variant="bodySm" fontWeight="semibold">
                                          Sıralama önemli!
                                        </Text>
                                        <Text as="p" variant="bodySm" color="subdued" style={{ marginTop: "4px" }}>
                                          Fotoğrafları sürükleyerek sıralayabilirsiniz. <strong style={{ color: "#6D5E00" }}>1. sıradaki fotoğraf Shopify'da ana ürün görseli olarak görünecek.</strong>
                                        </Text>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div 
                                  className="image-grid"
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                                    gap: "12px",
                                  }}
                                >
                                  {uploadedImages.map((img, index) => (
                                    <div
                                      key={img.id}
                                      className="image-card"
                                      draggable={!!img.colorMatch}
                                      onDragStart={(e) => handleDragStart(e, img.id)}
                                      onDragEnd={handleDragEnd}
                                      onDragOver={(e) => handleDragOver(e, img.id)}
                                      onDragLeave={handleDragLeave}
                                      onDrop={(e) => handleDrop(e, img.id)}
                                      style={{
                                        position: "relative",
                                        border: dragOverImageId === img.id 
                                          ? "2px dashed #5c6ac4" 
                                          : draggedImageId === img.id
                                            ? "2px dashed #8c9196"
                                            : "2px solid #e1e3e5",
                                        borderRadius: "8px",
                                        padding: "8px",
                                        backgroundColor: dragOverImageId === img.id ? "#f0f4ff" : "#fff",
                                        transition: "all 0.2s ease",
                                        cursor: img.colorMatch ? "grab" : "default",
                                        opacity: draggedImageId === img.id ? 0.5 : 1,
                                        transform: dragOverImageId === img.id ? "scale(1.02)" : "scale(1)"
                                      }}
                                    >
                                      {/* Sıra numarası */}
                                      {img.colorMatch && (
                                        <div style={{
                                          position: "absolute",
                                          top: "4px",
                                          left: "4px",
                                          width: "22px",
                                          height: "22px",
                                          borderRadius: "50%",
                                          background: "#5c6ac4",
                                          color: "white",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: "11px",
                                          fontWeight: "600",
                                          zIndex: 2
                                        }}>
                                          {index + 1}
                                        </div>
                                      )}
                                      <img
                                        src={img.preview}
                                        alt="Preview"
                                        draggable={false}
                                        style={{
                                          width: "100%",
                                          height: "120px",
                                          objectFit: "cover",
                                          borderRadius: "4px",
                                          pointerEvents: "none"
                                        }}
                                      />
                                      <Button
                                        size="slim"
                                        plain
                                        destructive
                                        onClick={() => removeImage(img.id)}
                                        style={{
                                          position: "absolute",
                                          top: "12px",
                                          right: "12px",
                                          backgroundColor: "rgba(255, 255, 255, 0.9)",
                                        }}
                                      >
                                        ✕
                                      </Button>
                                      
                                      {/* Renk eşleştirmesi gösterimi */}
                                      <div style={{ marginTop: "8px" }}>
                                        {img.colorMatch ? (
                                          <>
                                            <Badge tone="success">{img.colorMatch}</Badge>
                                            {(() => {
                                              const summary = getVariantSummaryForColor(img.colorMatch);
                                              if (!summary) return null;
                                              return (
                                                <Text as="p" variant="bodyXs" color="subdued" style={{ marginTop: 4 }}>
                                                  Bu görsel {summary.totalVariants} varyantta kullanılacak
                                                  {summary.sizesPreview
                                                    ? ` • Bedenler: ${summary.sizesPreview}${
                                                        summary.moreSizesCount > 0
                                                          ? ` +${summary.moreSizesCount} beden`
                                                          : ""
                                                      }`
                                                    : ""}
                                                </Text>
                                              );
                                            })()}
                                          </>
                                        ) : (
                                          <Text as="p" variant="bodySm" color="subdued">
                                            Renk atanmadı
                                          </Text>
                                        )}
                                      </div>

                                      {/* Manuel renk seçimi */}
                                      {preview && preview.colors && preview.colors.length > 0 && (
                                        <div style={{ marginTop: "8px" }}>
                                          <Select
                                            label=""
                                            options={[
                                              { label: "Renk seç...", value: "" },
                                              ...preview.colors.map(color => ({ label: color, value: color })),
                                            ]}
                                            value={img.colorMatch || ""}
                                            onChange={(value) => updateImageColorMatch(img.id, value)}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {/* Image Grid Mobile Styles */}
                                <style>{`
                                  @media (max-width: 400px) {
                                    .image-grid {
                                      grid-template-columns: repeat(2, 1fr) !important;
                                      gap: 8px !important;
                                    }
                                    .image-card img {
                                      height: 100px !important;
                                    }
                                  }
                                  @media (max-width: 320px) {
                                    .image-grid {
                                      grid-template-columns: 1fr !important;
                                    }
                                  }
                                  .image-card {
                                    transition: all 0.2s ease;
                                  }
                                  .image-card:hover {
                                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
                                    transform: translateY(-2px);
                                  }
                                `}</style>
                              </Stack>
                            )}
                          </>
                        )}
                        </Stack>
                      </div>
                    )}

                      {/* Eski çoklu seçim bölümü kaldırıldı - artık accordion içinde */}
                      {false && useMultiSelect && uploadedImages.some(img => img.colorMatch) && selectedProductIds.length > 0 && (
                        <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "2px solid #e1e3e5" }}>
                          <Stack vertical spacing="loose">
                            <Text as="h3" variant="headingSm">
                              📦 Ürünlere Görsel Atama
                            </Text>
                            <Text as="p" variant="bodySm" color="subdued">
                              Her ürün için hangi görsellerin atanacağını seçin ve ayrı ayrı yükleyin.
                            </Text>

                            {selectedProductIds.map((productId) => {
                              const product = productsData?.products?.find(p => p.id === productId);
                              const selectedImages = productImageSelections[productId] || [];
                              const imagesWithColor = uploadedImages.filter(img => img.colorMatch);
                              const allSelected = imagesWithColor.length > 0 && selectedImages.length === imagesWithColor.length;
                              
                              return (
                                <Card key={productId} sectioned>
                                  <Stack vertical spacing="base">
                                    <Stack alignment="baseline" distribution="equalSpacing">
                                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                                        {product?.title || productId}
                                      </Text>
                                      <Stack spacing="tight">
                                        <Button
                                          size="slim"
                                          plain
                                          onClick={() => toggleAllImagesForProduct(productId, !allSelected)}
                                          disabled={imagesWithColor.length === 0}
                                        >
                                          {allSelected ? "Seçimi Kaldır" : "Tümünü Seç"}
                                        </Button>
                                        <Button
                                          size="slim"
                                          primary
                                          onClick={() => handleUploadImagesToShopify(productId)}
                                          loading={isUploadingToShopify && uploadingProductId === productId}
                                          disabled={
                                            (isUploadingToShopify && uploadingProductId !== productId) ||
                                            selectedImages.length === 0
                                          }
                                        >
                                          {isUploadingToShopify && uploadingProductId === productId 
                                            ? "Yükleniyor..." 
                                            : `📤 Bu Ürüne Ekle (${selectedImages.length})`}
                                        </Button>
                                      </Stack>
                                    </Stack>

                                    {imagesWithColor.length > 0 ? (
                                      <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                                        gap: "0.75rem",
                                      }}>
                                        {imagesWithColor.map((img) => {
                                          const isSelected = selectedImages.includes(img.id);
                                          return (
                                            <div
                                              key={img.id}
                                              onClick={() => toggleProductImageSelection(productId, img.id)}
                                              style={{
                                                position: "relative",
                                                border: isSelected ? "2px solid #5c6ac4" : "2px solid #e1e3e5",
                                                borderRadius: "8px",
                                                padding: "6px",
                                                backgroundColor: isSelected ? "#f6f6f7" : "#fff",
                                                cursor: "pointer",
                                                transition: "all 0.2s",
                                              }}
                                              onMouseEnter={(e) => {
                                                if (!isSelected) {
                                                  e.currentTarget.style.borderColor = "#5c6ac4";
                                                }
                                              }}
                                              onMouseLeave={(e) => {
                                                if (!isSelected) {
                                                  e.currentTarget.style.borderColor = "#e1e3e5";
                                                }
                                              }}
                                            >
                                              <img
                                                src={img.preview}
                                                alt="Preview"
                                                style={{
                                                  width: "100%",
                                                  height: "100px",
                                                  objectFit: "cover",
                                                  borderRadius: "4px",
                                                }}
                                              />
                                              {isSelected && (
                                                <div style={{
                                                  position: "absolute",
                                                  top: "8px",
                                                  right: "8px",
                                                  backgroundColor: "#5c6ac4",
                                                  borderRadius: "50%",
                                                  width: "24px",
                                                  height: "24px",
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                  color: "white",
                                                  fontSize: "14px",
                                                }}>
                                                  ✓
                                                </div>
                                              )}
                                              <div style={{ marginTop: "4px", textAlign: "center" }}>
                                                <Badge tone={isSelected ? "success" : "subdued"} size="small">
                                                  {img.colorMatch}
                                                </Badge>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <Text as="p" variant="bodySm" color="subdued">
                                        Önce "Renklere Ayır" butonuna tıklayarak görselleri renklere eşleştirin.
                                      </Text>
                                    )}
                                  </Stack>
                                </Card>
                              );
                            })}
                          </Stack>
                        </div>
                      )}
                  </div>
                )}
              </Stack>
            </Card>
          </Layout.Section>
        )}
      </Layout>

      {/* Template Kaydetme Modal'ı */}
      <Modal
        open={showSaveTemplateModal}
        onClose={() => {
          setShowSaveTemplateModal(false);
          setTemplateName("");
        }}
        title="📋 Şablon Olarak Kaydet"
        primaryAction={{
          content: "💾 Kaydet",
          onAction: handleSaveTemplate,
          disabled: !templateName.trim(),
        }}
        secondaryActions={[
          {
            content: "İptal",
            onAction: () => {
              setShowSaveTemplateModal(false);
              setTemplateName("");
            },
          },
        ]}
      >
        <Modal.Section>
          <Stack vertical spacing="base">
            <Banner status="info">
            <Text as="p" variant="bodyMd">
                Bu varyant kombinasyonunu şablon olarak kaydedin. Daha sonra "Şablonlar" butonundan tek tıkla tekrar kullanabilirsiniz.
            </Text>
            </Banner>
            <TextField
              label="Şablon İsmi"
              value={templateName}
              onChange={setTemplateName}
              placeholder="Örnek: Basic Tişört, Yazlık Gömlek, Klasik Pantolon..."
              helpText="Şablonu kolayca bulabilmeniz için açıklayıcı bir isim verin"
              autoFocus
            />
            {preview && (
              <div>
                <Text as="p" variant="bodySm" fontWeight="semibold" color="subdued">
                  Kaydedilecek bilgiler:
                </Text>
                <Stack spacing="tight" vertical>
                  {preview.sizes.length > 0 && (
                    <Text as="p" variant="bodySm">
                      Bedenler: {preview.sizes.join(", ")}
                    </Text>
                  )}
                  {preview.colors.length > 0 && (
                    <Text as="p" variant="bodySm">
                      Renkler: {preview.colors.join(", ")}
                    </Text>
                  )}
                  {preview.basePrice && (
                    <Text as="p" variant="bodySm">
                      Temel Fiyat: ₺{preview.basePrice}
                    </Text>
                  )}
                </Stack>
              </div>
            )}
          </Stack>
        </Modal.Section>
      </Modal>

      {/* Mevcut Varyant Uyarı Modal'ı */}
      <Modal
        open={showExistingVariantWarning}
        onClose={() => {
          setShowExistingVariantWarning(false);
          setExistingVariantInfo(null);
        }}
        title="⚠️ Mevcut Varyant Uyarısı"
        primaryAction={{
          content: "Devam Et",
          onAction: () => {
            setShowExistingVariantWarning(false);
            // handleCreate'i tekrar çağır, bu sefer uyarı gösterilmeyecek
            setTimeout(() => handleCreate(), 100);
          },
        }}
        secondaryActions={[
          {
            content: "İptal",
            onAction: () => {
              setShowExistingVariantWarning(false);
              setExistingVariantInfo(null);
            },
          },
        ]}
      >
        <Modal.Section>
          <Stack vertical spacing="base">
            <Banner status="warning">
              <Text as="p" variant="bodyMd">
                Seçtiğiniz ürün(ler)de zaten varyant mevcut. Yeni varyantlar mevcut olanlara eklenecektir.
              </Text>
            </Banner>
            
            {existingVariantInfo && existingVariantInfo.products && (
              <div style={{ 
                background: "#fff8e6", 
                padding: "12px 16px", 
                borderRadius: "8px", 
                border: "1px solid #ffc453" 
              }}>
            <Stack vertical spacing="tight">
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                    Etkilenen ürünler:
              </Text>
                  {existingVariantInfo.products.map((product, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text as="span" variant="bodySm">
                        • {product.title}
                      </Text>
                      <Badge status="attention">
                        {product.variantsCount} mevcut varyant
                      </Badge>
                    </div>
                  ))}
                </Stack>
              </div>
            )}
            
            <div style={{ 
              background: "#f6f8fa", 
              padding: "12px 16px", 
              borderRadius: "8px" 
            }}>
              <Stack vertical spacing="extraTight">
                <Text as="p" variant="bodySm">
                  <strong>Eklenecek yeni varyant:</strong> {existingVariantInfo?.newVariantCount || 0} adet
              </Text>
              <Text as="p" variant="bodySm" color="subdued">
                  Not: Aynı beden/renk kombinasyonu varsa, mevcut varyantlar güncellenmeyecek, yenileri eklenecektir.
              </Text>
            </Stack>
            </div>
          </Stack>
        </Modal.Section>
      </Modal>

      {/* Akış tamamlandıktan sonra animasyonlu başarı kartı */}
      {flowCompleted && lastUploadStats && (
        <div 
          className="fade-in-scale"
          style={{ 
            position: "fixed", 
            bottom: 24, 
            right: 24, 
            maxWidth: 360, 
            zIndex: 10,
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0, 128, 96, 0.25)"
          }}
        >
          <div style={{
            background: "linear-gradient(135deg, #008060 0%, #00a878 100%)",
            padding: "16px",
            color: "white"
          }}>
            <Stack spacing="tight" alignment="center">
              {/* Animated Checkmark */}
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "successPop 0.5s ease-out forwards"
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ overflow: "visible" }}>
                  <path 
                    d="M5 13l4 4L19 7" 
                    stroke="white" 
                    strokeWidth="3" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{
                      strokeDasharray: 50,
                      strokeDashoffset: 50,
                      animation: "checkmark 0.5s ease-out 0.3s forwards"
                    }}
                  />
                </svg>
              </div>
              <div>
                <Text as="p" variant="bodyMd" fontWeight="bold">
                  <span style={{ color: "white" }}>Tamamlandı!</span>
              </Text>
                <Text as="p" variant="bodySm">
                  <span style={{ color: "rgba(255,255,255,0.85)" }}>{lastUploadStats.productName}</span>
              </Text>
              </div>
            </Stack>
          </div>
          <div style={{ background: "white", padding: "14px 16px" }}>
            <Stack vertical spacing="extraTight">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>📸</span>
                <Text as="span" variant="bodySm">
                  <strong>{lastUploadStats.uploaded}</strong> görsel yüklendi
              </Text>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>🏷️</span>
                <Text as="span" variant="bodySm">
                  <strong>{lastUploadStats.variantCount}</strong> varyanta atandı
                </Text>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "16px" }}>⏱️</span>
                <Text as="span" variant="bodySm" color="subdued">
                  ~{Math.max(1, Math.round(lastUploadStats.variantCount * 0.5))} dakika tasarruf
                </Text>
              </div>
            </Stack>
            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e1e3e5" }}>
              <Button
                size="slim"
                fullWidth
                onClick={() => setFlowCompleted(false)}
              >
                Yeni Varyant Oluştur
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* İlk Kullanım / Onboarding Modal */}
      <Modal
        open={showOnboarding}
        onClose={completeOnboarding}
        title="👋 Autovariant AI'a Hoş Geldiniz!"
        primaryAction={{
          content: "Başlayalım! 🚀",
          onAction: completeOnboarding,
        }}
      >
        <Modal.Section>
          <Stack vertical spacing="loose">
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: "64px", marginBottom: "16px" }}>✨</div>
              <Text as="h2" variant="headingLg">
                Varyant oluşturmak hiç bu kadar kolay olmamıştı!
              </Text>
            </div>

            <div style={{ 
              background: "#f6f8fa", 
              padding: "20px", 
              borderRadius: "12px",
              border: "1px solid #e1e3e5"
            }}>
              <Stack vertical spacing="base">
                <Stack spacing="tight" alignment="center">
                  <div style={{ 
                    background: "#008060", 
                    color: "white", 
                    borderRadius: "50%", 
                    width: "28px", 
                    height: "28px", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    fontWeight: "bold",
                    fontSize: "14px"
                  }}>1</div>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    Ürün Seçin
                  </Text>
                </Stack>
                <Text as="p" variant="bodySm" color="subdued" style={{ marginLeft: "36px" }}>
                  Mağazanızdaki ürünlerden varyant eklemek istediğinizi seçin
                </Text>

                <Stack spacing="tight" alignment="center">
                  <div style={{ 
                    background: "#008060", 
                    color: "white", 
                    borderRadius: "50%", 
                    width: "28px", 
                    height: "28px", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    fontWeight: "bold",
                    fontSize: "14px"
                  }}>2</div>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    Doğal Dille Yazın
                  </Text>
                </Stack>
                <Text as="p" variant="bodySm" color="subdued" style={{ marginLeft: "36px" }}>
                  "S'den XL'e kadar, kırmızı mavi beyaz, 200 lira" gibi yazın
                </Text>

                <Stack spacing="tight" alignment="center">
                  <div style={{ 
                    background: "#008060", 
                    color: "white", 
                    borderRadius: "50%", 
                    width: "28px", 
                    height: "28px", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    fontWeight: "bold",
                    fontSize: "14px"
                  }}>3</div>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    AI Oluştursun
                  </Text>
                </Stack>
                <Text as="p" variant="bodySm" color="subdued" style={{ marginLeft: "36px" }}>
                  AI tüm varyantları otomatik oluşturur, siz sadece onaylayın
                </Text>
              </Stack>
            </div>

            <Banner status="info">
              <Text as="p" variant="bodySm">
                💡 <strong>İpucu:</strong> "Örnekler" butonuna tıklayarak hazır prompt şablonlarını görebilirsiniz.
              </Text>
            </Banner>
          </Stack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

