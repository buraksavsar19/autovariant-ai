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

  // Prompt örnekleri
  const promptExamples = [
    {
      title: "Basit Beden ve Renk",
      text: "S'den 3XL'e kadar tüm bedenler, kırmızı yeşil mavi renkler, fiyat 500 lira"
    },
    {
      title: "Fiyat Kuralları ile",
      text: "S'den 3XL'e kadar tüm bedenler, kırmızı yeşil mavi sarı mor renkler, temel fiyat 400 lira, 2XL ve sonrası için fiyat +100 lira"
    },
    {
      title: "Stok Kuralları ile",
      text: "S'den 3XL'e kadar tüm bedenler, kırmızı yeşil mavi renkler, fiyat 500 lira, her varyant için 10 adet stok, 2XL için 5 adet stok"
    },
    {
      title: "Sadece Belirli Bedenler",
      text: "M, L, XL bedenler, siyah beyaz kırmızı renkler, fiyat 600 lira"
    },
    {
      title: "Geniş Renk Paleti",
      text: "S'den 2XL'e kadar tüm bedenler, kırmızı yeşil mavi sarı mor turuncu pembe siyah beyaz renkler, fiyat 450 lira"
    }
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

  // Geçmiş kayıtları ve template'leri yükle
  useEffect(() => {
    try {
      setHistory(getHistory());
      setTemplates(getTemplates());
    } catch (error) {
      console.error("History/Template yükleme hatası:", error);
    }
  }, []);

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

  const stepItems = [
    { id: 0, label: "Ürün & Prompt" },
    { id: 1, label: "Önizleme & Varyantlar" },
    { id: 2, label: "Renk – Görsel Eşleme" },
    { id: 3, label: "Tamamlandı" },
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
        return "Bir ürün seçin ve varyant kurallarınızı doğal dil ile yazın. Örnek: 'S'den 3XL'e kadar tüm bedenler, kırmızı yeşil mavi renkler, temel fiyat 200 lira'";
      case 1:
        return "Oluşturulacak varyantları önizleyin. Gerekirse düzenleyin ve 'Varyantları Oluştur' butonuna tıklayın.";
      case 2:
        return "Ürün fotoğraflarını yükleyin ve renklere otomatik eşleştirin. Her renk için uygun fotoğrafları seçin.";
      case 3:
        return "Tüm işlemler tamamlandı! Ürününüze gidip sonuçları kontrol edebilirsiniz.";
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

  // Ürünleri yükle
  const {
    data: productsData,
    isLoading: isLoadingProducts,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await fetch("/api/products/list");
      if (!response.ok) throw new Error("Ürünler yüklenemedi");
      return await response.json();
    },
    refetchOnWindowFocus: false,
  });

  // Prompt'u parse et ve önizleme göster
  const handlePreview = async (customPrompt = null) => {
    const promptToUse = customPrompt !== null ? customPrompt : prompt;
    
    if (!promptToUse || !promptToUse.trim()) {
      setError("Lütfen bir prompt girin");
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
      const response = await fetch("/api/variants/parse", {
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
          let variantStock = data.parsed.defaultStock || 0;

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
              const condition = rule.condition?.toLowerCase() || "";
              if (condition === "tümü" || condition === "hepsi" || condition === "her biri") {
                variantStock = rule.quantity || variantStock;
              } else if (condition.includes(size.toLowerCase())) {
                variantStock = rule.quantity || variantStock;
              }
            });
          }

          variants.push({
            id: `${sizeIndex}-${colorIndex}`,
            size,
            color,
            price: variantPrice.toFixed(2),
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

      setEditableVariants(variants);

      // Önizleme başarılı mesajı
      if (data.parsed.sizes.length > 0 || data.parsed.colors.length > 0) {
        setSuccess(null);
      } else {
        setError("Prompt'tan beden veya renk bilgisi çıkarılamadı");
      }
    } catch (err) {
      // Network hataları veya diğer beklenmeyen hatalar
      const errorMsg = err.message.includes("Failed to fetch")
        ? "Bağlantı hatası: Sunucuya erişilemiyor. Lütfen internet bağlantınızı kontrol edin."
        : `Önizleme oluşturulurken bir hata oluştu: ${err.message}`;
      setError(errorMsg);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Varyant düzenleme fonksiyonları
  const updateVariantPrice = (variantId, newPrice) => {
    if (variantsLocked) return;
    setEditableVariants(prev => 
      prev.map(v => 
        v.id === variantId 
          ? { ...v, price: parseFloat(newPrice) || 0 }
          : v
      )
    );
  };

  const updateVariantStock = (variantId, newStock) => {
    if (variantsLocked) return;
    setEditableVariants(prev => 
      prev.map(v => 
        v.id === variantId 
          ? { ...v, stock: parseInt(newStock) || 0 }
          : v
      )
    );
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

      const response = await fetch("/api/images/analyze-colors", {
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
      setError(`Renk analizi yapılırken bir hata oluştu: ${err.message}`);
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

      const response = await fetch("/api/images/analyze-colors", {
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
      setError(`Renk analizi yapılırken bir hata oluştu: ${err.message}`);
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

      const response = await fetch("/api/images/upload-to-shopify", {
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
      const errorMsg = err.message.includes("Failed to fetch")
        ? "Bağlantı hatası: Sunucuya erişilemiyor. Lütfen internet bağlantınızı kontrol edin."
        : `Görseller yüklenirken bir hata oluştu: ${err.message}`;
      setError(errorMsg);
      shopify.toast.show(errorMsg, { isError: true });
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
          const response = await fetch("/api/variants/create", {
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
      const errorMsg = err.message.includes("Failed to fetch") 
        ? "Bağlantı hatası: Sunucuya erişilemiyor. Lütfen internet bağlantınızı kontrol edin."
        : `Varyantlar oluşturulurken bir hata oluştu: ${err.message}`;
      setError(errorMsg);
      shopify.toast.show(errorMsg, { isError: true });
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
      <TitleBar title="Otomatik Varyant Oluşturucu" />
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <Stack vertical spacing="loose">
              {/* Üst adım göstergesi - Mobil uyumlu */}
              <div style={{ 
                marginBottom: "0.5rem", 
                width: "100%",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch"
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  minWidth: "fit-content",
                  padding: "4px 0"
                }}>
                  {stepItems.map((step, index) => {
                    const status = getStepStatus(step.id);
                    const isLast = index === stepItems.length - 1;
                    const bgColor =
                      status === "done" ? "#5c6ac4" : status === "current" ? "#2c6ecb" : "#d2d5d8";
                    const textColor = status === "upcoming" ? "#202223" : "#ffffff";
                    return (
                      <div key={step.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "999px",
                            backgroundColor: bgColor,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: textColor,
                            fontSize: 12,
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {status === "done" ? "✓" : step.id + 1}
                        </div>
                        <Text
                          as="span"
                          variant="bodySm"
                          color={status === "upcoming" ? "subdued" : undefined}
                          tone={status === "current" ? "success" : undefined}
                          style={{ 
                            marginLeft: 6, 
                            marginRight: 6, 
                            whiteSpace: "nowrap", 
                            fontSize: "12px", 
                            lineHeight: "1.2",
                            fontWeight: status === "current" ? 600 : 400
                          }}
                        >
                          {step.label}
                        </Text>
                        {!isLast && (
                          <div
                            style={{
                              width: 20,
                              height: 2,
                              backgroundColor:
                                currentStep > step.id ? "#5c6ac4" : "#e1e3e5",
                              marginRight: 4,
                              borderRadius: 999,
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
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
                </Banner>
              )}

              {error && (
                <Banner 
                  status="critical" 
                  onDismiss={() => setError(null)}
                  title={
                    error.includes("Bağlantı hatası") ? "🌐 Bağlantı Sorunu" :
                    error.includes("rate limit") ? "⏱️ İşlem Limiti" :
                    error.includes("API") ? "⚙️ Servis Hatası" :
                    "⚠️ Bir Sorun Oluştu"
                  }
                >
                  <Stack vertical spacing="tight">
                    <Text as="p" variant="bodyMd">
                      {error}
                    </Text>
                    
                    {/* Bağlantı hatası için yardım */}
                    {error.includes("Bağlantı hatası") && (
                      <Stack vertical spacing="extraTight">
                        <Text as="p" variant="bodySm" color="subdued">
                          💡 Şunları kontrol edin:
                        </Text>
                        <Text as="p" variant="bodySm" color="subdued">
                          • İnternet bağlantınız aktif mi?
                        </Text>
                        <Text as="p" variant="bodySm" color="subdued">
                          • Sayfayı yenileyip tekrar deneyin
                        </Text>
                      </Stack>
                    )}
                    
                    {/* Rate limit için yardım */}
                    {error.includes("rate limit") && (
                      <Text as="p" variant="bodySm" color="subdued">
                        💡 Birkaç saniye bekleyip tekrar deneyin. Çok fazla istek gönderildi.
                      </Text>
                    )}
                    
                    {/* Prompt hatası için yardım */}
                    {error.includes("Prompt") && (
                      <Text as="p" variant="bodySm" color="subdued">
                        💡 Örnek: "S'den XL'e kadar, kırmızı mavi yeşil, 100 TL"
                      </Text>
                    )}
                    
                    {/* Genel tekrar dene butonu */}
                    <Stack spacing="tight">
                      <Button 
                        size="slim" 
                        onClick={() => setError(null)}
                      >
                        Kapat
                      </Button>
                      {(error.includes("Bağlantı") || error.includes("rate limit")) && (
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
                    </Stack>
                  </Stack>
                </Banner>
              )}

              {success && (
                <Banner 
                  status="success" 
                  onDismiss={() => setSuccess(null)}
                  title="🎉 Başarılı!"
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
                <Banner status="info" title="Varyantlar Oluşturuluyor...">
                  <Stack vertical spacing="tight">
                    <Text as="p" variant="bodyMd">
                      {useMultiSelect && selectedProductIds.length > 1
                        ? `${selectedProductIds.length} ürün için varyantlar oluşturuluyor...`
                        : `${creationProgress.total} varyant oluşturuluyor. Lütfen bekleyin...`}
                    </Text>
                    <Stack>
                      <Spinner size="small" />
                      <Text as="span" variant="bodySm" color="subdued">
                        {useMultiSelect && selectedProductIds.length > 1
                          ? "Bu işlem birkaç dakika sürebilir"
                          : "Bu işlem birkaç saniye sürebilir"}
                      </Text>
                    </Stack>
                  </Stack>
                </Banner>
              )}

              {!isLoadingProducts &&
                productsData?.products &&
                productsData.products.length === 0 && (
                  <Banner status="info">
                    <Text as="p" variant="bodyMd">
                      Lütfen önce mağazanıza ürün ekleyin. Shopify admin
                      panelinden "Ürünler" menüsüne gidip yeni ürün ekleyebilirsiniz.
                    </Text>
                  </Banner>
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
                  disabled={isCreating || isLoadingProducts}
                />
              </Stack>

              {!useMultiSelect ? (
                <Select
                  label="Ürün"
                  options={productOptions}
                  value={selectedProductId}
                  onChange={setSelectedProductId}
                  disabled={
                    isLoadingProducts ||
                    isCreating ||
                    (productsData?.products &&
                      productsData.products.length === 0)
                  }
                />
              ) : (
                <Card sectioned>
                  <Stack vertical spacing="base">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Ürünler ({selectedProductIds.length} seçili)
                    </Text>
                    <Text as="p" variant="bodySm" color="subdued">
                      Aynı varyant kombinasyonunu birden fazla ürüne uygulamak için ürünleri seçin
                    </Text>
                    <Stack vertical spacing="base">
                      {productsData?.products && productsData.products.length > 0 ? (
                        productsData.products.map((product) => (
                          <Checkbox
                            key={product.id}
                            label={product.title}
                            checked={selectedProductIds.includes(product.id)}
                            onChange={(checked) => {
                              if (checked) {
                                setSelectedProductIds([...selectedProductIds, product.id]);
                              } else {
                                setSelectedProductIds(selectedProductIds.filter(id => id !== product.id));
                              }
                            }}
                            disabled={isCreating}
                          />
                        ))
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

              {isLoadingProducts && (
                <Stack>
                  <Spinner size="small" />
                  <Text as="span">Ürünler yükleniyor...</Text>
                </Stack>
              )}

              {/* Template'ler - Prompt alanının üstünde */}
              <Card sectioned>
                <Stack vertical spacing="tight">
                  <Stack alignment="baseline" distribution="equalSpacing">
                    <Button
                      plain
                      onClick={() => setShowTemplates(!showTemplates)}
                      ariaExpanded={showTemplates}
                      ariaControls="templates-section"
                    >
                      <Stack spacing="tight" alignment="center">
                        <Text as="h3" variant="headingSm">
                          📋 Kaydedilmiş Şablonlar
                        </Text>
                        <Badge>{templates.length}</Badge>
                      </Stack>
                    </Button>
                  </Stack>
                  <Collapsible
                    open={showTemplates}
                    id="templates-section"
                    transition={{ duration: "200ms", timingFunction: "ease-in-out" }}
                  >
                      <Stack vertical spacing="tight">
                        <Text as="p" variant="bodySm" color="subdued">
                          Sık kullandığınız kombinasyonları şablon olarak kaydedin. Template'i seçerek hızlıca kullanabilirsiniz.
                        </Text>
                        <Stack vertical spacing="base">
                          {templates.map((template) => {
                            const sizesText = template.sizes?.join(", ") || "Belirtilmemiş";
                            const colorsText = template.colors?.join(", ") || "Belirtilmemiş";
                            const date = new Date(template.timestamp);
                            const formattedDate = date.toLocaleDateString("tr-TR", {
                              day: "numeric",
                              month: "short",
                            });
                            
                            return (
                              <Card key={template.id} sectioned>
                                <Stack vertical spacing="base">
                                  <Stack alignment="baseline" distribution="equalSpacing">
                                    <Stack vertical spacing="extraTight" fill>
                                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                                        {template.name}
                                      </Text>
                                      <Stack spacing="tight" wrap>
                                        <Badge>{sizesText}</Badge>
                                        <Badge>{colorsText}</Badge>
                                        {template.basePrice && (
                                          <Badge>₺{template.basePrice}</Badge>
                                        )}
                                      </Stack>
                                      <Text as="p" variant="bodySm" color="subdued">
                                        {formattedDate}
                                      </Text>
                                    </Stack>
                                  </Stack>
                                  <Stack spacing="tight">
                                    <Button
                                      size="medium"
                                      primary
                                      onClick={() => useTemplate(template)}
                                      disabled={isCreating || isLoadingPreview}
                                    >
                                      ✅ Bu Template'i Kullan
                                    </Button>
                                    <Button
                                      size="medium"
                                      plain
                                      destructive
                                      onClick={() => removeTemplate(template.id)}
                                    >
                                      🗑️ Sil
                                    </Button>
                                  </Stack>
                                </Stack>
                              </Card>
                            );
                          })}
                          {templates.length === 0 && (
                            <Card sectioned subdued>
                              <Stack vertical spacing="tight" alignment="center">
                                <Text as="p" variant="bodyMd" color="subdued" alignment="center">
                                  📋 Henüz kaydedilmiş şablon yok
                                </Text>
                                <Text as="p" variant="bodySm" color="subdued" alignment="center">
                                  Varyant oluşturduktan sonra "Template Olarak Kaydet" butonuna tıklayarak 
                                  sık kullandığınız kombinasyonları kaydedebilirsiniz.
                                </Text>
                              </Stack>
                            </Card>
                          )}
                        </Stack>
                      </Stack>
                    </Collapsible>
                  </Stack>
                </Card>

              {/* Geçmiş Kayıtlar */}
              <Card sectioned>
                <Stack vertical spacing="tight">
                  <Stack alignment="baseline" distribution="equalSpacing">
                    <Button
                      plain
                      onClick={() => setShowHistory(!showHistory)}
                      ariaExpanded={showHistory}
                      ariaControls="history-section"
                    >
                      <Stack spacing="tight" alignment="center">
                        <Text as="h3" variant="headingSm">
                          📚 Geçmiş Kombinasyonlar
                          </Text>
                          <Badge>{history.length}</Badge>
                        </Stack>
                      </Button>
                    </Stack>
                    <Collapsible
                      open={showHistory}
                      id="history-section"
                      transition={{ duration: "200ms", timingFunction: "ease-in-out" }}
                    >
                      <Stack vertical spacing="tight">
                        <Text as="p" variant="bodySm" color="subdued">
                          Daha önce oluşturduğunuz kombinasyonları tekrar kullanabilirsiniz
                        </Text>
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
                            style={{
                              padding: "12px",
                              border: "1px solid #e1e3e5",
                              borderRadius: "6px",
                              cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#f6f6f7";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <Stack alignment="baseline" distribution="equalSpacing">
                              <Stack vertical spacing="extraTight" fill>
                                <Stack spacing="tight">
                                  <Badge>{sizesText}</Badge>
                                  <Badge>{colorsText}</Badge>
                                  {item.variantCount > 0 && (
                                    <Badge>{item.variantCount} varyant</Badge>
                                  )}
                                </Stack>
                                <Text as="p" variant="bodySm" color="subdued">
                                  {formattedDate}
                                </Text>
                              </Stack>
                              <Stack spacing="tight">
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
                              </Stack>
                            </Stack>
                          </div>
                        );
                      })}
                          {history.length === 0 && (
                            <Card sectioned subdued>
                              <Stack vertical spacing="tight" alignment="center">
                                <Text as="p" variant="bodyMd" color="subdued" alignment="center">
                                  📚 Henüz geçmiş işlem yok
                                </Text>
                                <Text as="p" variant="bodySm" color="subdued" alignment="center">
                                  Varyant oluşturdukça geçmiş burada görünecek. 
                                  Aynı kombinasyonları tekrar kullanmak için geçmişten seçebilirsiniz.
                                </Text>
                              </Stack>
                            </Card>
                          )}
                        </Stack>
                        {history.length > 5 && (
                          <Text as="p" variant="bodySm" color="subdued" alignment="center">
                            ... ve {history.length - 5} kayıt daha
                          </Text>
                        )}
                      </Stack>
                    </Collapsible>
                  </Stack>
                </Card>

              <Stack vertical spacing="tight">
                <Stack alignment="baseline" distribution="equalSpacing">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    Varyant Açıklaması (Prompt)
                  </Text>
                  <Button
                    size="slim"
                    plain
                    onClick={() => setShowPromptExamples(true)}
                    disabled={isCreating}
                  >
                    📝 Örnekler
                  </Button>
                </Stack>
                <TextField
                  value={prompt}
                  onChange={setPrompt}
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

              {/* Hazır prompt şablonları */}
              <Stack spacing="tight" wrap>
                <Button
                  size="slim"
                  onClick={() => {
                    const example =
                      "S'den 3XL'e kadar tüm bedenler, beyaz siyah lacivert renkler, fiyat 499 lira, 2XL ve üzeri için fiyat +100 lira, her varyant için 10 adet stok";
                    setPrompt(example);
                  }}
                  disabled={isCreating || isLoadingPreview}
                >
                  Basic Tişört
                </Button>
                <Button
                  size="slim"
                  onClick={() => {
                    const example =
                      "36'dan 44'e kadar tüm numaralar, siyah beyaz kırmızı renkler, fiyat 1299 lira, 42 ve üzeri numaralar için fiyat +150 lira, her varyant için 5 adet stok";
                    setPrompt(example);
                  }}
                  disabled={isCreating || isLoadingPreview}
                >
                  Sneaker
                </Button>
                <Button
                  size="slim"
                  onClick={() => {
                    const example =
                      "XS'den XL'e kadar bedenler, pudra siyah zümrüt yeşili renkler, fiyat 899 lira, XS için stok 3 adet, diğerleri için 8 adet stok";
                    setPrompt(example);
                  }}
                  disabled={isCreating || isLoadingPreview}
                >
                  Elbise
                </Button>
              </Stack>

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
            </Stack>
          </Card>
        </Layout.Section>

        {/* AI İşliyor Loading State */}
        {isLoadingPreview && (
          <Layout.Section>
            <Card sectioned>
              <Stack vertical spacing="loose" alignment="center">
                <div style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  alignItems: "center", 
                  padding: "40px 20px",
                  gap: "16px"
                }}>
                  <div style={{ 
                    width: "60px", 
                    height: "60px", 
                    borderRadius: "50%", 
                    background: "linear-gradient(135deg, #5C6AC4 0%, #00D4AA 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    animation: "pulse 1.5s ease-in-out infinite"
                  }}>
                    <span style={{ fontSize: "28px" }}>🤖</span>
                  </div>
                  <Text as="h3" variant="headingMd" alignment="center">
                    AI Prompt'unuzu Analiz Ediyor...
                  </Text>
                  <Text as="p" variant="bodySm" color="subdued" alignment="center">
                    Varyant kombinasyonları oluşturuluyor. Bu işlem birkaç saniye sürebilir.
                  </Text>
                  <Spinner size="small" />
                </div>
              </Stack>
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
                    size="slim"
                    onClick={() => setShowSaveTemplateModal(true)}
                  >
                    📋 Template olarak kaydet
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
                  {editableVariants.length > 0 && (
                    <div style={{ marginTop: "1rem", overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
                            <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Beden</th>
                            <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Renk</th>
                            <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Fiyat (₺)</th>
                            <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Stok (Adet)</th>
                            <th style={{ padding: "12px", textAlign: "center", fontWeight: "600", width: "80px" }}>İşlem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editableVariants.map((variant) => (
                            <tr key={variant.id} style={{ borderBottom: "1px solid #e1e3e5" }}>
                              <td style={{ padding: "12px" }}>
                                <Badge>{variant.size}</Badge>
                              </td>
                              <td style={{ padding: "12px" }}>
                                <Badge>{variant.color}</Badge>
                              </td>
                              <td style={{ padding: "12px" }}>
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
                              <td style={{ padding: "12px" }}>
                                <TextField
                                  type="number"
                                  value={variant.stock.toString()}
                                  onChange={(value) => updateVariantStock(variant.id, value)}
                                  suffix="adet"
                                  autoComplete="off"
                                  min="0"
                                disabled={variantsLocked}
                                />
                              </td>
                              <td style={{ padding: "12px", textAlign: "center" }}>
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
                      <div id="image-upload-section">
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

                                <div style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                                  gap: "1rem",
                                }}>
                                  {uploadedImages.map((img) => (
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
        title="Template Olarak Kaydet"
        primaryAction={{
          content: "Kaydet",
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
            <Text as="p" variant="bodyMd">
              Bu kombinasyonu template olarak kaydedebilirsiniz. Daha sonra tekrar kullanmak için kolayca erişebilirsiniz.
            </Text>
            <TextField
              label="Template İsmi"
              value={templateName}
              onChange={setTemplateName}
              placeholder="Örnek: Tişört Template, Gömlek Varyantları, Klasik Kombinasyon..."
              helpText="Bu template'i tanımlayıcı bir isim verin. Örnek: 'Tişört Template', 'Gömlek Varyantları' gibi"
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

      {/* Akış tamamlandıktan sonra küçük başarı kartı */}
      {flowCompleted && lastUploadStats && (
        <div style={{ position: "fixed", bottom: 24, right: 24, maxWidth: 340, zIndex: 10 }}>
          <Card sectioned>
            <Stack vertical spacing="tight">
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                Akış tamamlandı 🎉
              </Text>
              <Text as="p" variant="bodySm" color="subdued">
                {lastUploadStats.productName} için {lastUploadStats.uploaded} görsel, yaklaşık{" "}
                {lastUploadStats.variantCount} varyanta başarıyla atandı.
              </Text>
              <Text as="p" variant="bodySm" color="subdued">
                Manuel yapmaya göre ~{Math.max(1, Math.round(lastUploadStats.variantCount * 0.5))} dakika kazandın.
              </Text>
            </Stack>
          </Card>
        </div>
      )}
    </Page>
  );
}

