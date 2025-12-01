import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ExitIframe() {
  const navigate = useNavigate();

  useEffect(() => {
    // ExitIframe sayfasına gelindiğinde direkt root'a yönlendir
    // Bu sayfa sadece Shopify admin'e yönlendirme için kullanılmalı
    // Ama app ilk yüklendiğinde buraya gelmemeli
    navigate("/", { replace: true });
  }, [navigate]);

  // Hiçbir şey gösterme - direkt yönlendir
  return null;
}
