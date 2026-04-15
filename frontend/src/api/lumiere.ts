import api from "./axiosInstance";
import type {
  LumiereReplyInput,
  LumiereReplyResult,
  LumiereSuggestion,
} from "../types/lumiere";

export async function lumiereReply(
  input: LumiereReplyInput
): Promise<LumiereReplyResult> {
  const response = await api.post<LumiereReplyResult>("/lumiere/reply/", {
    text: input.text,
    locale: input.locale,
    userName: input.userName,
    page: input.page ?? "",
    history: input.history ?? [],
  });

  const data = response.data;

  return {
    text: typeof data?.text === "string" ? data.text : "",
    suggestions: Array.isArray(data?.suggestions)
      ? (data.suggestions as LumiereSuggestion[])
      : undefined,
  };
}