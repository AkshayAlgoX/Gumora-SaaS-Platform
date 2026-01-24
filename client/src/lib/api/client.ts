import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api/_proxy",
  withCredentials: true,
});
