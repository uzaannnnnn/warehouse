import apiClient from "../../../lib/apiClient";

export async function fetchProductions({ page, limit, search } = {}) {
  const { data } = await apiClient.get("/warehouse/productions", {
    params: {
      page,
      limit,
      search,
    },
  });
  return data?.data || { items: [], total: 0, pages: 1 };
}

export async function createProductionRecord(payload) {
  const body = {
    invoiceNumber: payload.invoiceNumber,
    productionNumber: payload.productionNumber,
    date: payload.date,
    rawItems: payload.rawItems?.map((item) => ({
      productCode: item.productCode || item.kode,
      quantity: item.quantity ?? item.qty,
    })),
    finishedItems: payload.finishedItems?.map((item) => ({
      productCode: item.productCode || item.kode,
      quantity: item.quantity ?? item.qty,
    })),
  };
  const { data } = await apiClient.post("/warehouse/productions", body);
  return data?.data;
}

export async function fetchProductionBuffer() {
  const { data } = await apiClient.get("/warehouse/production-buffer");
  return data?.data || [];
}

export async function saveProductionBuffer(items) {
  const body = {
    items: items?.map((item) => ({
      productCode: item.productCode || item.kode,
      productName: item.productName || item.name,
      quantity: item.quantity ?? item.qty,
    })),
  };
  const { data } = await apiClient.post("/warehouse/production-buffer", body);
  return data?.data || [];
}
