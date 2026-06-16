import axios from "axios";

// Mengambil IP dari file .env Vite
const IP_ADDRESS = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: IP_ADDRESS,
});

export default api;
