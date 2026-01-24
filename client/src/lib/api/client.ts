import axios from "axios";

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

// Interceptor to remove double /api/ if it exists
client.interceptors.request.use((config) => {
  if (config.url?.startsWith("/api/")) {
    config.url = config.url.substring(4); // Remove first /api/
  }
  return config;
});

export const apiClient = client;
