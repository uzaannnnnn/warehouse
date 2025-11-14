import apiClient from "../../../lib/apiClient";

export async function loginRequest(payload) {
  const { data } = await apiClient.post("/auth/login", payload);
  return data?.data;
}
