import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function ExitIframe() {
  const { search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // redirectUri yoksa veya search parametresi yoksa, direkt root'a yönlendir (hiçbir şey gösterme)
    if (!search) {
      navigate("/", { replace: true });
      return;
    }

    const params = new URLSearchParams(search);
    const redirectUri = params.get("redirectUri");
    
    if (!redirectUri) {
      // redirectUri yoksa, app'in root URL'ine yönlendir (hiçbir şey gösterme)
      navigate("/", { replace: true });
      return;
    }

    try {
      const url = new URL(decodeURIComponent(redirectUri));

      // Shopify domain'leri kontrol et
      const isShopifyDomain = 
        url.hostname === "admin.shopify.com" ||
        url.hostname.endsWith(".myshopify.com") ||
        url.hostname === window.location.hostname;

      if (isShopifyDomain) {
        // Shopify domain'ine yönlendir
        window.open(url.toString(), "_top");
      } else {
        // Geçersiz external URL - root'a yönlendir (uyarı gösterme)
        navigate("/", { replace: true });
      }
    } catch (error) {
      // Geçersiz URL, app'in root URL'ine yönlendir (hiçbir şey gösterme)
      navigate("/", { replace: true });
    }
  }, [search, navigate]);

  // Hiçbir şey gösterme - sadece yönlendirme yap
  return null;
}
