import { useState, useEffect, useRef } from "react";
import {
  Page,
  Card,
  Layout,
  Select,
  Button,
  Banner,
  Spinner,
  Stack,
  Text,
  Badge,
  Checkbox,
  TextField,
  DataTable,
  Modal,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useQuery } from "react-query";

export default function VariantManager() {
  const app = useAppBridge();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantIds, setSelectedVariantIds] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [sizeFilter, setSizeFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [targetProductId, setTargetProductId] = useState("");
  const [isCopying, setIsCopying] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Ürünleri listele
  const { data: productsData, isLoading: isLoadingProducts } = useQuery(
    ["products"],
    async () => {
      const response = await fetch("/api/products/list");
      const data = await response.json();
      return data;
    }
  );

  // Varyantları listele
  const { data: variantsData, isLoading: isLoadingVariants, refetch: refetchVariants } = useQuery(
    ["variants", selectedProductId],
    async () => {
      if (!selectedProductId) return null;
      const response = await fetch(`/api/variants/list?productId=${selectedProductId}`);
      const data = await response.json();
      return data;
    },
    {
      enabled: !!selectedProductId,
    }
  );

  // Filtreleme
  const filteredVariants = variantsData?.variants?.filter((variant) => {
    const sizeOption = variant.selectedOptions.find(
      (opt) => opt.name.toLowerCase() === "beden" || opt.name.toLowerCase() === "size"
    );
    const colorOption = variant.selectedOptions.find(
      (opt) => opt.name.toLowerCase() === "renk" || opt.name.toLowerCase() === "color"
    );

    const sizeMatch = !sizeFilter || sizeOption?.value === sizeFilter;
    const colorMatch = !colorFilter || colorOption?.value === colorFilter;

    return sizeMatch && colorMatch;
  }) || [];

  // Tüm bedenleri ve renkleri çıkar (filtre için)
  const availableSizes = [
    ...new Set(
      variantsData?.variants
        ?.map((v) =>
          v.selectedOptions.find(
            (opt) => opt.name.toLowerCase() === "beden" || opt.name.toLowerCase() === "size"
          )?.value
        )
        .filter(Boolean) || []
    ),
  ].sort();

  const availableColors = [
    ...new Set(
      variantsData?.variants
        ?.map((v) =>
          v.selectedOptions.find(
            (opt) => opt.name.toLowerCase() === "renk" || opt.name.toLowerCase() === "color"
          )?.value
        )
        .filter(Boolean) || []
    ),
  ].sort();

  // Varyant seçimi
  const handleSelectVariant = (variantId) => {
    setSelectedVariantIds((prev) =>
      prev.includes(variantId)
        ? prev.filter((id) => id !== variantId)
        : [...prev, variantId]
    );
  };

  const handleSelectAll = () => {
    if (selectedVariantIds.length === filteredVariants.length) {
      setSelectedVariantIds([]);
    } else {
      setSelectedVariantIds(filteredVariants.map((v) => v.id));
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!selectedProductId) {
      setError("Lütfen önce bir ürün seçin");
      return;
    }
    window.location.href = `/api/variants/export-csv?productId=${selectedProductId}`;
  };

  // CSV Import
  const handleImportCSV = async () => {
    if (!selectedProductId) {
      setError("Lütfen önce bir ürün seçin");
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Lütfen bir CSV dosyası seçin");
      return;
    }

    setIsImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("csv", file);
      formData.append("productId", selectedProductId);

      const response = await fetch("/api/variants/import-csv", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`${data.updatedCount} varyant başarıyla güncellendi`);
        refetchVariants();
        fileInputRef.current.value = "";
      } else {
        setError(data.error || "CSV import başarısız oldu");
      }
    } catch (err) {
      console.error("CSV import hatası:", err);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsImporting(false);
    }
  };

  // Varyant kopyalama
  const handleCopyVariants = async () => {
    if (!selectedProductId || !targetProductId) {
      setError("Lütfen kaynak ve hedef ürünü seçin");
      return;
    }

    if (selectedProductId === targetProductId) {
      setError("Kaynak ve hedef ürün aynı olamaz");
      return;
    }

    setIsCopying(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/variants/copy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceProductId: selectedProductId,
          targetProductId: targetProductId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`${data.copiedCount} varyant başarıyla kopyalandı`);
        setShowCopyModal(false);
        setTargetProductId("");
      } else {
        setError(data.error || "Varyantlar kopyalanırken bir hata oluştu");
      }
    } catch (err) {
      console.error("Varyant kopyalama hatası:", err);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsCopying(false);
    }
  };

  // Varyant silme
  const handleDelete = async () => {
    if (selectedVariantIds.length === 0) {
      setError("Lütfen silmek istediğiniz varyantları seçin");
      return;
    }

    setIsDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/variants/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ variantIds: selectedVariantIds }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`${data.deletedCount} varyant başarıyla silindi`);
        setSelectedVariantIds([]);
        refetchVariants();
      } else {
        setError(data.error || "Varyantlar silinirken bir hata oluştu");
      }
    } catch (err) {
      console.error("Varyant silme hatası:", err);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Tablo için satırlar
  const rows = filteredVariants.map((variant) => {
    const sizeOption = variant.selectedOptions.find(
      (opt) => opt.name.toLowerCase() === "beden" || opt.name.toLowerCase() === "size"
    );
    const colorOption = variant.selectedOptions.find(
      (opt) => opt.name.toLowerCase() === "renk" || opt.name.toLowerCase() === "color"
    );

    return [
      <Checkbox
        key={variant.id}
        checked={selectedVariantIds.includes(variant.id)}
        onChange={() => handleSelectVariant(variant.id)}
        label=""
      />,
      variant.title || "-",
      sizeOption?.value || "-",
      colorOption?.value || "-",
      `₺${parseFloat(variant.price).toFixed(2)}`,
      variant.inventoryQuantity || 0,
      variant.sku || "-",
    ];
  });

  return (
    <Page
      title="Varyant Yönetimi"
      primaryAction={{
        content: "Varyant Oluştur",
        url: "/variant-creator",
      }}
    >
      <TitleBar title="Varyant Yönetimi" />
      <Layout>
        {error && (
          <Layout.Section>
            <Banner status="critical" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}

        {success && (
          <Layout.Section>
            <Banner status="success" onDismiss={() => setSuccess(null)}>
              <p>{success}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card sectioned>
            <Stack vertical spacing="loose">
              <Select
                label="Ürün Seçin"
                options={[
                  { label: "Ürün seçin...", value: "" },
                  ...(productsData?.products?.map((product) => ({
                    label: product.title,
                    value: product.id,
                  })) || []),
                ]}
                value={selectedProductId}
                onChange={setSelectedProductId}
                disabled={isLoadingProducts}
              />

              {selectedProductId && isLoadingVariants && (
                <Stack alignment="center">
                  <Spinner size="small" />
                  <Text>Varyantlar yükleniyor...</Text>
                </Stack>
              )}

              {selectedProductId && variantsData && (
                <>
                  <Stack distribution="equalSpacing" alignment="center">
                    <Text variant="headingMd">
                      {variantsData.product?.title || "Ürün"}
                    </Text>
                    <Text variant="bodyMd" tone="subdued">
                      {filteredVariants.length} varyant
                    </Text>
                  </Stack>

                  {/* Filtreler */}
                  <Stack>
                    {availableSizes.length > 0 && (
                      <Stack.Item>
                        <Select
                          label="Beden Filtresi"
                          options={[
                            { label: "Tümü", value: "" },
                            ...availableSizes.map((size) => ({
                              label: size,
                              value: size,
                            })),
                          ]}
                          value={sizeFilter}
                          onChange={setSizeFilter}
                        />
                      </Stack.Item>
                    )}

                    {availableColors.length > 0 && (
                      <Stack.Item>
                        <Select
                          label="Renk Filtresi"
                          options={[
                            { label: "Tümü", value: "" },
                            ...availableColors.map((color) => ({
                              label: color,
                              value: color,
                            })),
                          ]}
                          value={colorFilter}
                          onChange={setColorFilter}
                        />
                      </Stack.Item>
                    )}
                  </Stack>

                  {/* Toplu işlemler */}
                  <Stack vertical spacing="tight">
                    <Stack distribution="equalSpacing" alignment="center">
                      <Stack>
                        <Checkbox
                          checked={
                            filteredVariants.length > 0 &&
                            selectedVariantIds.length === filteredVariants.length
                          }
                          onChange={handleSelectAll}
                          label={`Tümünü Seç (${selectedVariantIds.length}/${filteredVariants.length})`}
                        />
                      </Stack>
                      <Stack spacing="tight">
                        <Button
                          onClick={handleExportCSV}
                          disabled={!selectedProductId}
                        >
                          CSV Export
                        </Button>
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={!selectedProductId}
                        >
                          CSV Import
                        </Button>
                        <Button
                          onClick={() => setShowCopyModal(true)}
                          disabled={!selectedProductId}
                        >
                          Varyantları Kopyala
                        </Button>
                        <Button
                          destructive
                          disabled={selectedVariantIds.length === 0 || isDeleting}
                          loading={isDeleting}
                          onClick={handleDelete}
                        >
                          Seçilenleri Sil ({selectedVariantIds.length})
                        </Button>
                      </Stack>
                    </Stack>

                    {/* CSV Import Input (hidden) */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      style={{ display: "none" }}
                      onChange={handleImportCSV}
                    />
                  </Stack>

                  {/* Varyant tablosu */}
                  {filteredVariants.length > 0 ? (
                    <DataTable
                      columnContentTypes={[
                        "text",
                        "text",
                        "text",
                        "text",
                        "numeric",
                        "numeric",
                        "text",
                      ]}
                      headings={[
                        "",
                        "Varyant",
                        "Beden",
                        "Renk",
                        "Fiyat",
                        "Stok",
                        "SKU",
                      ]}
                      rows={rows}
                    />
                  ) : (
                    <Card sectioned>
                      <Stack alignment="center">
                        <Text>Bu üründe varyant bulunamadı</Text>
                      </Stack>
                    </Card>
                  )}
                </>
              )}
            </Stack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Varyant Kopyalama Modal */}
      <Modal
        open={showCopyModal}
        onClose={() => {
          setShowCopyModal(false);
          setTargetProductId("");
        }}
        title="Varyantları Kopyala"
        primaryAction={{
          content: "Kopyala",
          onAction: handleCopyVariants,
          loading: isCopying,
          disabled: !targetProductId || isCopying,
        }}
        secondaryActions={[
          {
            content: "İptal",
            onAction: () => {
              setShowCopyModal(false);
              setTargetProductId("");
            },
          },
        ]}
      >
        <Modal.Section>
          <Stack vertical spacing="loose">
            <Text variant="bodyMd">
              <strong>Kaynak Ürün:</strong> {variantsData?.product?.title || "Seçilmedi"}
            </Text>
            <Select
              label="Hedef Ürün Seçin"
              options={[
                { label: "Hedef ürün seçin...", value: "" },
                ...(productsData?.products
                  ?.filter((p) => p.id !== selectedProductId)
                  .map((product) => ({
                    label: product.title,
                    value: product.id,
                  })) || []),
              ]}
              value={targetProductId}
              onChange={setTargetProductId}
            />
            <Text variant="bodySm" tone="subdued">
              Kaynak ürünün tüm varyantları hedef ürüne kopyalanacaktır. Varyantlar oluşturulurken fiyat ve stok bilgileri de kopyalanır.
            </Text>
          </Stack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

