import apiClient from "../../../lib/apiClient";

export async function fetchProductions({ page, limit, search, location } = {}) {
  const { data } = await apiClient.get("/warehouse/productions", {
    params: {
      page,
      limit,
      search,
      location,
    },
  });
  return data?.data || { items: [], total: 0, pages: 1 };
}

export async function createProductionRecord(payload) {
  const body = {
    productionNumber: payload.productionNumber,
    location: payload.location,
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

  if (payload.invoiceNumber) {
    body.invoiceNumber = payload.invoiceNumber;
  }

  const { data } = await apiClient.post("/warehouse/productions", body);
  return data?.data;
}

export async function fetchProductionBuffer(location) {
  const { data } = await apiClient.get("/warehouse/production-buffer", {
    params: { location },
  });
  return data?.data || { items: [], invoiceNumber: "" };
}

export async function saveProductionBuffer(items, location, invoiceNumber) {
  const body = {
    location,
    invoiceNumber,
    items: items?.map((item) => ({
      productCode: item.productCode || item.kode,
      productName: item.productName || item.name,
      quantity: item.quantity ?? item.qty,
    })),
  };
  const { data } = await apiClient.post("/warehouse/production-buffer", body);
  return data?.data || { items: [], invoiceNumber: "" };
}
