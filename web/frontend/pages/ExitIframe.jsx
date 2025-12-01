import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Banner, Layout, Page } from "@shopify/polaris";

export default function ExitIframe() {
  const app = useAppBridge();
  const { search } = useLocation();
  const [showWarning, setShowWarning] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // redirectUri yoksa veya search parametresi yoksa, direkt root'a yönlendir (uyarı gösterme)
    if (!search) {
      setIsRedirecting(true);
      window.location.replace("/");
      return;
    }

    const params = new URLSearchParams(search);
    const redirectUri = params.get("redirectUri");
    
    if (!redirectUri) {
      // redirectUri yoksa, app'in root URL'ine yönlendir (uyarı gösterme)
      setIsRedirecting(true);
      window.location.replace("/");
      return;
    }

    try {
      const url = new URL(decodeURIComponent(redirectUri));

      if (
        [window.location.hostname, "admin.shopify.com"].includes(url.hostname) ||
        url.hostname.endsWith(".myshopify.com")
      ) {
        setIsRedirecting(true);
        window.open(url, "_top");
      } else {
        // Sadece geçersiz external URL'ler için uyarı göster
        setShowWarning(true);
      }
    } catch (error) {
      // Geçersiz URL, app'in root URL'ine yönlendir (uyarı gösterme)
      setIsRedirecting(true);
      window.location.replace("/");
    }
  }, [app, search]);

  // Yönlendirme yapılıyorsa hiçbir şey gösterme
  if (isRedirecting) {
    return null;
  }

  // Sadece geçersiz external URL için uyarı göster
  return showWarning ? (
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
  ) : null;
}
