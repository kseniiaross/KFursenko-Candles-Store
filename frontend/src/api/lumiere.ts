import api from "./axiosInstance";
import { getCurrentApiLanguage } from "./candles";

export type LumiereLocale = "en" | "ru" | "es" | "fr";

export type LumiereSearchSuggestion = {
  id: number;
  name: string;
  slug: string;
  price: string;
  in_stock: boolean;
  description?: string;
  fragrance_family?: string;
  intensity?: string;
  top_notes?: string[];
  heart_notes?: string[];
  base_notes?: string[];
  mood_tags?: string[];
  use_case_tags?: string[];
  ideal_spaces?: string[];
  season_tags?: string[];
  match_reason?: string;
};

export type LumiereSearchResponse = {
  query: string;
  text?: string;
  suggestions: LumiereSearchSuggestion[];
};

export type LumiereHistoryMessage = {
  role: "user" | "assistant";
  text: string;
};

export type LumiereReplyPayload = {
  text: string;
  locale?: LumiereLocale;
  userName?: string | null;
  page?: string;
  history?: LumiereHistoryMessage[];
};

export type LumiereReply = {
  text: string;
  suggestions?: LumiereSearchSuggestion[];
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

export async function sendLumiereReply(
  payload: LumiereReplyPayload,
): Promise<LumiereReply> {
  const response = await api.post<LumiereReply>("/lumiere/reply/", {
    ...payload,
    text: payload.text.trim(),
    locale: payload.locale ?? getCurrentApiLanguage(),
    userName: payload.userName ?? null,
    page: payload.page ?? "",
    history: payload.history ?? [],
  });

  return response.data;
}