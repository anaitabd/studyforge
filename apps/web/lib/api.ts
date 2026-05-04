import axios, { AxiosError, AxiosRequestConfig } from "axios";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  timeout: 30000,
});

export const LONG_AI_REQUEST_TIMEOUT_MS = 600000;

let _getToken: (() => Promise<string | null>) | null = null;
let _onUnauthorized: (() => void) | null = null;
let _onUpgradeRequired: ((reason: string) => void) | null = null;

export function registerTokenGetter(fn: () => Promise<string | null>) { _getToken = fn; }
export function registerUnauthorizedHandler(fn: () => void) { _onUnauthorized = fn; }
export function registerUpgradeHandler(fn: (reason: string) => void) { _onUpgradeRequired = fn; }
export async function getToken(): Promise<string | null> { return _getToken ? _getToken() : null; }

api.interceptors.request.use(async (config) => {
  if (_getToken) {
    const token = await _getToken();
    if (token) config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ detail?: unknown }>) => {
    const status = err.response?.status;
    const detailRaw = err.response?.data?.detail;
    const detail = detailRaw as { message?: string; error?: string } | string | undefined;
    const message =
      err.code === "ECONNABORTED"
        ? "This AI request is taking longer than expected. Please keep this window open; large learning paths can take several minutes. If it still times out, try fewer modules or fewer source files."
        : typeof detail === "string"
          ? detail
          : detail?.message ?? err.message ?? "Something went wrong";

    if (status === 401) _onUnauthorized?.();
    if (status === 402 || (status === 429 && typeof detail === "object" && detail?.error === "limit_exceeded")) {
      _onUpgradeRequired?.(typeof detail === "object" ? detail?.message ?? "Upgrade required" : message);
    }
    if (status === 500) toast.error("Something went wrong. Please try again.");

    const error = new Error(message) as Error & { status?: number; detail?: unknown };
    error.status = status;
    error.detail = detail;
    return Promise.reject(error);
  }
);

export default api;

// Typed helpers
export async function apiGet<T>(url: string, config?: AxiosRequestConfig) {
  return (await api.get<T>(url, config)).data;
}
export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig) {
  return (await api.post<T>(url, body, config)).data;
}
export async function apiPut<T>(url: string, body?: unknown, config?: AxiosRequestConfig) {
  return (await api.put<T>(url, body, config)).data;
}
export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig) {
  return (await api.patch<T>(url, body, config)).data;
}
export async function apiDelete<T>(url: string, config?: AxiosRequestConfig) {
  return (await api.delete<T>(url, config)).data;
}
