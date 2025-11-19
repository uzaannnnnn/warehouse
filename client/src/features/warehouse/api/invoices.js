import apiClient from "../../../lib/apiClient";

export async function fetchInvoices({
  page,
  limit,
  search,
  segment,
  location,
  metaSource,
  metaMode,
  productionClaimedOnly,
} = {}) {
  const { data } = await apiClient.get("/warehouse/invoices", {
    params: {
      page,
      limit,
      search,
      segment,
      location,
      metaSource,
      metaMode,
      productionClaimed: productionClaimedOnly ? "true" : undefined,
    },
  });
  return data?.data || { items: [], total: 0, pages: 1 };
}

export async function createInvoiceRecord(payload) {
  const body = {
    invoiceNumber: payload.invoiceNumber,
    type: payload.type,
    location: payload.location,
    segment: payload.segment,
    items: payload.items?.map((item) => ({
      productCode: item.productCode || item.kode,
      quantity: item.quantity ?? item.qty,
    })),
  };
  const { data } = await apiClient.post("/warehouse/invoices", body);
  return data?.data;
}

export async function claimInvoiceForProduction(invoiceNumber) {
  const trimmed = String(invoiceNumber || "").trim();
  const encoded = encodeURIComponent(trimmed);
  const { data } = await apiClient.post(
    `/warehouse/invoices/${encoded}/claim-production`,
  );
  return data?.data;
}
