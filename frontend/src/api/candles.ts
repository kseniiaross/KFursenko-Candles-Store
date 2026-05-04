import i18n from "../i18n";
import api from "../api/axiosInstance";
import type { Candle, Category } from "../types/candle";

export type CandleListParams = {
  search?: string;
  ordering?: "price" | "-price" | "created_at" | "-created_at" | "name" | "-name";
  category?: number;
  in_stock?: boolean;
};

type SupportedApiLanguage = "en" | "ru" | "es" | "fr";

export function getCurrentApiLanguage(): SupportedApiLanguage {
  const lang = i18n.language?.split("-")[0];

  if (lang === "ru" || lang === "es" || lang === "fr") {
    return lang;
  }

  return "en";
}

function toQuery(params?: CandleListParams): Record<string, string> {
  const query: Record<string, string> = {
    lang: getCurrentApiLanguage(),
  };

  if (!params) return query;

  if (params.search?.trim()) {
    query.search = params.search.trim();
  }

  if (params.ordering) {
    query.ordering = params.ordering;
  }

  if (typeof params.category === "number") {
    query.category = String(params.category);
  }

  if (typeof params.in_stock === "boolean") {
    query.in_stock = params.in_stock ? "true" : "false";
  }

  return query;
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
    `/candles/candles/${encodeURIComponent(safeSlug)}/`,
    {
      params: {
        lang: getCurrentApiLanguage(),
      },
    },
  );

  return response.data;
}

export async function getCollectionScentsBySlug(slug: string): Promise<Candle[]> {
  const safeSlug = String(slug).trim();

  const response = await api.get<Candle[]>(
    `/candles/candles/${encodeURIComponent(safeSlug)}/collection_scents/`,
    {
      params: {
        lang: getCurrentApiLanguage(),
      },
    },
  );

  return response.data;
}

export async function listCategories(): Promise<Category[]> {
  const response = await api.get<Category[]>("/candles/categories/", {
    params: {
      lang: getCurrentApiLanguage(),
    },
  });

  return response.data;
}