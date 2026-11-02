export const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export async function request(path, signal) {
  const response = await fetch(API + path, { signal });
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error("Resposta inesperada da API."); }
  if (!response.ok) {
    throw new Error(typeof payload.detail === "string" ? payload.detail : "Pedido recusado pela API.");
  }
  return payload;
}
export const urlDistrict = (district) => encodeURIComponent(district);
export const formatArea = (value) => value == null ? "—" :
  new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(value);
export const formatPercent = (value) => value == null ? "—" :
  new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(value) + "%";
