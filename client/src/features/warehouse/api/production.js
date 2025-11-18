import apiClient from "../../../lib/apiClient";

export async function fetchProductions({
  page,
  limit,
  search,
  location,
  status,
} = {}) {
  const { data } = await apiClient.get("/warehouse/productions", {
    params: {
      page,
      limit,
      search,
      location,
      status,
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

  if (payload.packaging && payload.packaging.code && payload.packaging.quantity) {
    body.packaging = {
      productCode: payload.packaging.code,
      quantity: payload.packaging.quantity,
      location: payload.packaging.location,
    };
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
      productCategory: item.productCategory || item.category,
    })),
  };
  const { data } = await apiClient.post("/warehouse/production-buffer", body);
  return data?.data || { items: [], invoiceNumber: "" };
}

export async function updateProductionQc(id, qcItems) {
  const body = {
    qcItems: qcItems.map((it) => ({
      productCode: it.productCode || it.kode,
      okQuantity: it.okQuantity ?? it.okQty,
    })),
  };

  const { data } = await apiClient.patch(`/warehouse/productions/${id}/qc`, body);
  return data?.data;
}

export async function fetchProductionResults({
  page,
  limit,
  search,
  location,
} = {}) {
  const { data } = await apiClient.get("/warehouse/production-results", {
    params: {
      page,
      limit,
      search,
      location,
    },
  });
  return data?.data || { items: [], total: 0, pages: 1 };
}

export async function destroyProductionReject({ productCode, location, quantity }) {
  const body = {
    productCode,
    location,
    quantity,
  };
  const { data } = await apiClient.post(
    "/warehouse/production-results/destroy",
    body,
  );
  return data?.data;
}

export async function fetchProductionStockRequests({
  page,
  limit,
  status,
  targetLocation,
  originLocation,
} = {}) {
  const { data } = await apiClient.get("/warehouse/production-stock-requests", {
    params: {
      page,
      limit,
      status,
      targetLocation,
      originLocation,
    },
  });
  return data?.data || { items: [], total: 0, pages: 1 };
}

export async function createProductionStockRequest(payload) {
  const body = {
    originLocation: payload.originLocation,
    targetLocation: payload.targetLocation,
    items: payload.items?.map((item) => ({
      productCode: item.productCode || item.kode,
      quantity: Number(item.quantity ?? item.qty ?? 0),
    })),
  };
  const { data } = await apiClient.post(
    "/warehouse/production-stock-requests",
    body,
  );
  return data?.data;
}

export async function approveProductionStockRequest(id, options = {}) {
  const { note, items } = options || {};
  const trimmed = typeof note === "string" ? note.trim() : "";
  const body = {};
  if (trimmed) {
    body.note = trimmed;
  }
  if (Array.isArray(items) && items.length) {
    body.items = items
      .map((item) => {
        const code = String(item.productCode || item.kode || "").trim();
        const quantity = Number(item.quantity ?? item.qty ?? 0);
        if (!code || !Number.isFinite(quantity) || quantity <= 0) {
          return null;
        }
        return {
          productCode: code.toUpperCase(),
          quantity,
        };
      })
      .filter(Boolean);
    if (!body.items.length) {
      delete body.items;
    }
  }
  const { data } = await apiClient.post(
    `/warehouse/production-stock-requests/${id}/approve`,
    body,
  );
  return data?.data;
}

export async function rejectProductionStockRequest(id, note) {
  const trimmed = note?.trim();
  const body = {};
  if (trimmed) {
    body.note = trimmed;
  }
  const { data } = await apiClient.post(
    `/warehouse/production-stock-requests/${id}/reject`,
    body,
  );
  return data?.data;
}
