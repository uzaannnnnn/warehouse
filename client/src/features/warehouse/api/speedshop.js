import apiClient from "../../../lib/apiClient";

export async function fetchSpeedshopOrders(params = {}) {
  const { data } = await apiClient.get("/warehouse/speedshop/orders", {
    params: {
      page: params.page,
      limit: params.limit,
      search: params.search,
      status: params.status,
      location: params.location,
    },
  });
  return data?.data || { items: [], total: 0, pages: 1 };
}

export async function fetchSpeedshopOrder(id) {
  const { data } = await apiClient.get(`/warehouse/speedshop/orders/${id}`);
  return data?.data;
}

export async function createSpeedshopOrder(payload) {
  const { data } = await apiClient.post("/warehouse/speedshop/orders", payload);
  return data?.data;
}

export async function updateSpeedshopOrder(id, payload) {
  const { data } = await apiClient.put(
    `/warehouse/speedshop/orders/${id}`,
    payload,
  );
  return data?.data;
}

export async function updateSpeedshopOrderStatus(id, payload) {
  const { data } = await apiClient.patch(
    `/warehouse/speedshop/orders/${id}/status`,
    payload,
  );
  return data?.data;
}

export async function fetchSpeedshopServices() {
  const { data } = await apiClient.get("/warehouse/speedshop/services");
  return data?.data || [];
}

