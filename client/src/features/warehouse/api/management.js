import apiClient from "../../../lib/apiClient";

export async function fetchManagementUsers(params = {}) {
  const query = {};
  if (params.search) query.search = params.search;
  if (params.role) query.role = params.role;

  const { data } = await apiClient.get("/management/users", { params: query });
  return data?.data || [];
}

export async function createManagementUser(payload) {
  const body = {
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: payload.role,
    locationCode: payload.locationCode || undefined,
  };
  const { data } = await apiClient.post("/management/users", body);
  return data?.data;
}

export async function fetchManagementLocations() {
  const { data } = await apiClient.get("/management/locations");
  return data?.data || [];
}

export async function fetchManagementLocationsByType(type) {
  const all = await fetchManagementLocations();
  if (!type) return all;
  return all.filter((loc) => loc.type === type);
}

export async function createManagementLocation(payload) {
  const body = {
    name: payload.name,
    type: payload.type,
  };
  const { data } = await apiClient.post("/management/locations", body);
  return data?.data;
}

export async function updateManagementUser(id, payload) {
  const body = {
    name: payload.name,
    password: payload.password,
    role: payload.role,
    locationCode: payload.locationCode || undefined,
  };
  const { data } = await apiClient.put(`/management/users/${id}`, body);
  return data?.data;
}

export async function deleteManagementUser(id, confirmPassword) {
  const { data } = await apiClient.delete(`/management/users/${id}`, {
    data: { confirmPassword },
  });
  return data?.data;
}
