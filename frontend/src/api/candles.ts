import api from "../api/axiosInstance";
import type { Candle, Category } from "../types/candle";

export type CandleListParams = {
  search?: string;
  ordering?: "price" | "-price" | "created_at" | "-created_at" | "name" | "-name";
  category?: number;
  in_stock?: boolean;
};

function toQuery(params?: CandleListParams): Record<string, string> {
  const q: Record<string, string> = {};

  if (!params) return q;

  if (params.search) q.search = params.search;
  if (params.ordering) q.ordering = params.ordering;

  if (typeof params.category === "number") {
    q.category = String(params.category);
  }

  if (typeof params.in_stock === "boolean") {
    q.in_stock = params.in_stock ? "true" : "false";
  }

  return q;
}

export async function listCandles(params?: CandleListParams): Promise<Candle[]> {
  const response = await api.get<Candle[]>("/candles/candles/", {
    params: toQuery(params),
  });

  return response.data;
}

export async function getCandleBySlug(slug: string): Promise<Candle> {
  const safeSlug = String(slug).trim();

  const response = await api.get<Candle>(
    `/candles/candles/${encodeURIComponent(safeSlug)}/`
  );

  return response.data;
}

export async function getCollectionScentsBySlug(slug: string): Promise<Candle[]> {
  const safeSlug = String(slug).trim();

  const response = await api.get<Candle[]>(
    `/candles/candles/${encodeURIComponent(safeSlug)}/collection_scents/`
  );

  return response.data;
}

export async function listCategories(): Promise<Category[]> {
  const response = await api.get<Category[]>("/candles/categories/");
  return response.data;
}