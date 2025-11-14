import apiClient from "../../../lib/apiClient";

export async function fetchInvoices({ page, limit, search } = {}) {
  const { data } = await apiClient.get("/warehouse/invoices", {
    params: {
      page,
      limit,
      search,
    },
  });
  return data?.data || { items: [], total: 0, pages: 1 };
}

export async function createInvoiceRecord(payload) {
  const body = {
    invoiceNumber: payload.invoiceNumber,
    type: payload.type,
    items: payload.items?.map((item) => ({
      productCode: item.productCode || item.kode,
      quantity: item.quantity ?? item.qty,
    })),
  };
  const { data } = await apiClient.post("/warehouse/invoices", body);
  return data?.data;
}
