import { useState, useEffect } from "react";
import {
  Page,
  Card,
  Layout,
  Stack,
  Text,
  Button,
  Banner,
  Spinner,
  Badge,
} from "@shopify/polaris";
import { useNavigate } from "react-router-dom";

export default function Pricing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [billingStatus, setBillingStatus] = useState(null);
  const [error, setError] = useState(null);

  // Pricing planları
  const plans = [
    {
      name: "Starter Plan",
      price: 4.99,
      interval: "one-time",
      description: "Küçük mağazalar için ideal",
      features: [
        "10 varyant analizi",
        "Temel AI özellikleri",
        "Email desteği",
      ],
    },
    {
      name: "Basic Plan",
      price: 19.99,
      interval: "one-time",
      description: "Orta ölçekli mağazalar için",
      features: [
        "50 varyant analizi",
        "Gelişmiş AI özellikleri",
        "Öncelikli email desteği",
        "PDF export",
      ],
    },
    {
      name: "Pro Plan",
      price: 39.99,
      interval: "one-time",
      description: "Büyük mağazalar için",
      features: [
        "Sınırsız varyant analizi",
        "Tüm AI özellikleri",
        "7/24 öncelikli destek",
        "PDF export",
        "Batch processing",
      ],
    },
    {
      name: "Premium Plan",
      price: 59.99,
      interval: "one-time",
      description: "Enterprise çözüm",
      features: [
        "Sınırsız varyant analizi",
        "Tüm AI özellikleri",
        "Dedicated destek",
        "PDF export",
        "Batch processing",
        "API access",
      ],
    },
    {
      name: "Monthly Subscription",
      price: 49.99,
      interval: "monthly",
      description: "Düzenli kullanım için",
      features: [
        "Sınırsız varyant analizi",
        "Tüm AI özellikleri",
        "Öncelikli destek",
        "PDF export",
        "Batch processing",
      ],
      popular: true,
    },
  ];

  // Billing durumunu kontrol et
  useEffect(() => {
    const checkBillingStatus = async () => {
      try {
        const response = await fetch("/api/billing/status");
        const data = await response.json();
        setBillingStatus(data);
      } catch (err) {
        console.error("Billing status kontrolü hatası:", err);
      }
    };

    checkBillingStatus();
  }, []);

  // Plan satın alma
  const handlePurchase = async (planName) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planName }),
      });

      const data = await response.json();

      if (response.ok && data.confirmationUrl) {
        // Shopify checkout sayfasına yönlendir
        window.location.href = data.confirmationUrl;
      } else {
        setError(data.error || "Plan satın alma işlemi başarısız oldu");
        setLoading(false);
      }
    } catch (err) {
      console.error("Plan satın alma hatası:", err);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setLoading(false);
    }
  };

  return (
    <Page
      title="Fiyatlandırma Planları"
      primaryAction={{
        content: "Varyant Oluşturucu'ya Dön",
        onAction: () => navigate("/variant-creator"),
      }}
    >
      <Layout>
        {billingStatus?.hasActivePayment && (
          <Layout.Section>
            <Banner status="success" title="Aktif Ödeme Planınız Var">
              <p>
                Bu uygulamayı kullanmaya devam edebilirsiniz. Farklı bir plana
                geçmek isterseniz aşağıdaki planlardan birini seçebilirsiniz.
              </p>
            </Banner>
          </Layout.Section>
        )}

        {error && (
          <Layout.Section>
            <Banner status="critical" title="Hata">
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Stack vertical spacing="tight">
            <Text variant="headingMd" as="h2">
              Size Uygun Planı Seçin
            </Text>
            <Text variant="bodyMd" tone="subdued">
              Tüm planlar Shopify güvenliği ile korunmaktadır
            </Text>
          </Stack>
        </Layout.Section>

        <Layout.Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
              marginTop: "20px",
            }}
          >
            {plans.map((plan) => (
              <Card key={plan.name} sectioned>
                <Stack vertical spacing="tight">
                  {plan.popular && (
                    <Badge status="success">En Popüler</Badge>
                  )}
                  <Text variant="headingMd" as="h3">
                    {plan.name}
                  </Text>
                  <Stack vertical spacing="extraTight">
                    <Text variant="headingXl" as="p">
                      ${plan.price}
                    </Text>
                    <Text variant="bodyMd" tone="subdued">
                      {plan.interval === "monthly" ? "aylık" : "tek seferlik"}
                    </Text>
                  </Stack>
                  <Text variant="bodyMd" tone="subdued">
                    {plan.description}
                  </Text>
                  <Stack vertical spacing="tight">
                    {plan.features.map((feature, index) => (
                      <Stack key={index} spacing="tight">
                        <Text variant="bodyMd">✓ {feature}</Text>
                      </Stack>
                    ))}
                  </Stack>
                  <div style={{ marginTop: "16px" }}>
                    <Button
                      primary={plan.popular}
                      fullWidth
                      onClick={() => handlePurchase(plan.name)}
                      loading={loading}
                      disabled={loading}
                    >
                      Planı Seç
                    </Button>
                  </div>
                </Stack>
              </Card>
            ))}
          </div>
        </Layout.Section>

        <Layout.Section>
          <Card sectioned>
            <Stack vertical spacing="tight">
              <Text variant="headingMd" as="h3">
                Sıkça Sorulan Sorular
              </Text>
              <Text variant="bodyMd">
                <strong>Plan değişikliği yapabilir miyim?</strong>
                <br />
                Evet, istediğiniz zaman farklı bir plana geçiş yapabilirsiniz.
              </Text>
              <Text variant="bodyMd">
                <strong>İade politikası nedir?</strong>
                <br />
                30 gün içinde memnun kalmazsanız tam iade yapılır.
              </Text>
              <Text variant="bodyMd">
                <strong>Test modu nedir?</strong>
                <br />
                Development ortamında tüm işlemler test modunda çalışır ve gerçek ödeme alınmaz.
              </Text>
            </Stack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}




