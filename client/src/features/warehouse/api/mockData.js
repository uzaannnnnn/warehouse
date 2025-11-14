import apiClient from "../../../lib/apiClient";

export const variants = [];

export const formatRupiah = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return "-";
  return `Rp ${number.toLocaleString("id-ID")}`;
};

const normalizeProductPayload = (product) => {
  const code =
    product.kodeProduk ||
    product.code ||
    product.kode ||
    product.productCode ||
    "";
  return {
    code: code?.trim().toUpperCase(),
    name: product.name || product.nama || "",
    category:
      typeof product.category === "object"
        ? product.category?._id || product.category?.name
        : product.category || null,
    purchasePrice:
      typeof product.hargaBeli === "number"
        ? product.hargaBeli
        : product.purchasePrice ?? null,
    sellingPrice:
      typeof product.hargaJual === "number"
        ? product.hargaJual
        : product.sellingPrice ?? null,
    stock: typeof product.stock === "number" ? product.stock : undefined,
    _id: product._id,
  };
};

export async function fetchCategories() {
  const { data } = await apiClient.get("/warehouse/categories");
  return data?.data || [];
}

export async function fetchProductsPaged(params = {}) {
  const { data } = await apiClient.get("/warehouse/products", {
    params: {
      page: params.page,
      limit: params.limit,
      search: params.search,
    },
  });
  return data?.data || { items: [], total: 0, pages: 1 };
}

export async function fetchProductById(id) {
  const { data } = await apiClient.get(`/warehouse/products/${id}`);
  return data?.data;
}

export async function deleteProductById(id) {
  await apiClient.delete(`/warehouse/products/${id}`);
}

export async function upsertProduct(product) {
  const payload = normalizeProductPayload(product);
  const body = {
    code: payload.code,
    name: payload.name,
    category: payload.category,
    purchasePrice:
      typeof payload.purchasePrice === "number" ? payload.purchasePrice : 0,
    sellingPrice:
      typeof payload.sellingPrice === "number" ? payload.sellingPrice : 0,
  };

  if (!payload._id) {
    const { data } = await apiClient.post("/warehouse/products", body);
    return data?.data;
  }

  const { data } = await apiClient.put(`/warehouse/products/${payload._id}`, body);
  return data?.data;
}

export async function fetchRawCategories() {
  const { data } = await apiClient.get("/warehouse/raw-categories");
  return data?.data || [];
}

export async function fetchRawProductsPaged(params = {}) {
  const { data } = await apiClient.get("/warehouse/raw-products", {
    params: {
      page: params.page,
      limit: params.limit,
      search: params.search,
    },
  });
  return data?.data || { items: [], total: 0, pages: 1 };
}

export async function fetchRawProductById(id) {
  const { data } = await apiClient.get(`/warehouse/raw-products/${id}`);
  return data?.data;
}

export async function deleteRawProductById(id) {
  await apiClient.delete(`/warehouse/raw-products/${id}`);
}

export async function upsertRawProduct(product) {
  const payload = normalizeProductPayload(product);
  const body = {
    code: payload.code,
    name: payload.name,
    category: payload.category,
    purchasePrice:
      typeof payload.purchasePrice === "number" ? payload.purchasePrice : 0,
    sellingPrice:
      typeof payload.sellingPrice === "number" ? payload.sellingPrice : 0,
  };

  if (!payload._id) {
    const { data } = await apiClient.post("/warehouse/raw-products", body);
    return data?.data;
  }

  const { data } = await apiClient.put(`/warehouse/raw-products/${payload._id}`, body);
  return data?.data;
}
