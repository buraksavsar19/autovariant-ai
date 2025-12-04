import { BrowserRouter } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NavMenu } from "@shopify/app-bridge-react";
import { ErrorBoundary } from "@sentry/react";
import Routes from "./Routes";

import { QueryProvider, PolarisProvider } from "./components";

export default function App() {
  // Any .tsx or .jsx files in /pages will become a route
  // See documentation for <Routes /> for more info
  const pages = import.meta.glob("./pages/**/!(*.test.[jt]sx)*.([jt]sx)", {
    eager: true,
  });
  const { t } = useTranslation();

  return (
    <ErrorBoundary
      fallback={({ error }) => (
        <div style={{ padding: "20px", textAlign: "center" }}>
          <h2>Bir hata oluştu</h2>
          <p>Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.</p>
          {import.meta.env.MODE === "development" && (
            <pre style={{ textAlign: "left", marginTop: "20px" }}>
              {error?.toString()}
            </pre>
          )}
        </div>
      )}
      showDialog={false}
    >
      <PolarisProvider>
        <BrowserRouter>
          <QueryProvider>
            <NavMenu>
              <a href="/" rel="home" />
              <a href="/variant-creator">Varyant Oluşturucu</a>
              <a href="/pagename">{t("NavigationMenu.pageName")}</a>
            </NavMenu>
            <Routes pages={pages} />
          </QueryProvider>
        </BrowserRouter>
      </PolarisProvider>
    </ErrorBoundary>
  );
}
