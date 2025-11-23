import axios from "axios";
import { AUTH_STORAGE_KEY } from "../constants/storage";

const envBaseUrl = import.meta.env.VITE_API_URL?.trim();
let baseURL = envBaseUrl;

if (!baseURL && typeof window !== "undefined") {
  console.warn(
    "VITE_API_URL belum dikonfigurasi, fallback ke origin saat ini. Set VITE_API_URL pada file .env client agar API berjalan dengan benar.",
  );
  baseURL = window.location.origin;
}

if (!baseURL) {
  baseURL = "/";
}

const apiClient = axios.create({
  baseURL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.token) {
          config.headers.Authorization = `Bearer ${parsed.token}`;
        }
      } catch {
        // ignore corrupted entry
      }
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (typeof window !== "undefined" && status === 401) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      window.location.href = "/login";
    }
    const message =
      error?.response?.data?.message ??
      error?.message ??
      "Terjadi kesalahan saat menghubungi server";
    return Promise.reject({ ...error, message });
  },
);

export default apiClient;
