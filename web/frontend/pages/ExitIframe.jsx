import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Banner, Layout, Page } from "@shopify/polaris";

export default function ExitIframe() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // redirectUri yoksa veya search parametresi yoksa, direkt root'a yönlendir
    if (!search) {
      navigate("/", { replace: true });
      return;
    }

    const params = new URLSearchParams(search);
    const redirectUri = params.get("redirectUri");
    
    if (!redirectUri) {
      // redirectUri yoksa, app'in root URL'ine yönlendir
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
        // Geçersiz external URL - uyarı göster
        setShowWarning(true);
      }
    } catch (error) {
      // Geçersiz URL, app'in root URL'ine yönlendir
      console.error("Invalid redirectUri:", error);
      navigate("/", { replace: true });
    }
  }, [search, navigate]);

  // Sadece geçersiz external URL için uyarı göster
  if (showWarning) {
    return (
      <Page narrowWidth>
        <Layout>
          <Layout.Section>
            <div style={{ marginTop: "100px" }}>
              <Banner title="Redirecting outside of Shopify" status="warning">
                Apps can only use /exitiframe to reach Shopify or the app itself.
              </Banner>
            </div>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // Yönlendirme yapılıyorsa hiçbir şey gösterme
  return null;
}
