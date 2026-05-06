import api from "./axiosInstance";
import { getCurrentApiLanguage } from "./candles";

export type LumiereSearchSuggestion = {
  id: number;
  name: string;
  slug: string;
  price: string;
  in_stock: boolean;
  description?: string;
  fragrance_family?: string;
  intensity?: string;
  match_reason?: string;
};

export type LumiereSearchResponse = {
  query: string;
  text?: string;
  suggestions: LumiereSearchSuggestion[];
};

export async function searchWithLumiere(
  query: string,
  limit = 8,
  explain = true,
): Promise<LumiereSearchResponse> {
  const response = await api.post<LumiereSearchResponse>("/lumiere/search/", {
    query: query.trim(),
    locale: getCurrentApiLanguage(),
    limit,
    explain,
  });

  return response.data;
}