import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  timeout: 30000,
});


api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const detail = err.response?.data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message ?? err.message ?? "Something went wrong";
    const error = new Error(message) as Error & {
      status: number;
      detail: unknown;
    };
    error.status = status;
    error.detail = detail;
    return Promise.reject(error);
  }
);

export default api;

// Helper used in components/hooks — attaches the live Clerk JWT
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}
