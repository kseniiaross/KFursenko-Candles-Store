import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { lumiereReply } from "../api/lumiere";
import type {
  Locale,
  LumiereHistoryMessage,
  LumiereMessage,
  LumierePersistedState,
  LumiereReplyResult,
  LumiereStatus,
} from "../types/lumiere";

const SESSION_STORAGE_KEY = "lumiere_session_v1";

type EnsureGreetingPayload = {
  isLoggedIn: boolean;
  firstName: string | null;
};

type SendLumiereMessagePayload = {
  text: string;
  locale: Locale;
  userName: string | null;
  history: LumiereHistoryMessage[];
  page?: string;
};

type LumiereState = {
  isOpen: boolean;
  locale: Locale;
  speak: boolean;
  userName: string | null;
  messages: LumiereMessage[];
  status: LumiereStatus;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function createMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `lumiere-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createMessage(
  role: "assistant" | "user",
  text: string,
  suggestions?: LumiereReplyResult["suggestions"]
): LumiereMessage {
  return {
    id: createMessageId(),
    role,
    text,
    createdAt: Date.now(),
    suggestions,
  };
}

function getGreetingText(locale: Locale, firstName: string | null): string {
  const safeName = firstName?.trim() || null;

  if (locale === "ru") {
    return safeName
      ? `Здравствуйте, ${safeName}. Я Lumière. Помогу подобрать свечу, аромат или подарок.`
      : "Здравствуйте. Я Lumière. Помогу подобрать свечу, аромат или подарок.";
  }

  if (locale === "es") {
    return safeName
      ? `Hola, ${safeName}. Soy Lumière. Puedo ayudarte a elegir una vela, un aroma o un regalo.`
      : "Hola. Soy Lumière. Puedo ayudarte a elegir una vela, un aroma o un regalo.";
  }

  if (locale === "fr") {
    return safeName
      ? `Bonjour, ${safeName}. Je suis Lumière. Je peux vous aider à choisir une bougie, un parfum ou un cadeau.`
      : "Bonjour. Je suis Lumière. Je peux vous aider à choisir une bougie, un parfum ou un cadeau.";
  }

  return safeName
    ? `Hello, ${safeName}. I’m Lumière. I can help you choose a candle, scent, or gift.`
    : "Hello. I’m Lumière. I can help you choose a candle, scent, or gift.";
}

function readPersistedState(): LumierePersistedState | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LumierePersistedState>;

    const locale = parsed.locale;
    const speak = parsed.speak;
    const userName = parsed.userName;
    const messages = parsed.messages;

    const localeIsValid =
      locale === "en" || locale === "ru" || locale === "es" || locale === "fr";

    if (!localeIsValid) return null;
    if (typeof speak !== "boolean") return null;
    if (!(typeof userName === "string" || userName === null)) return null;
    if (!Array.isArray(messages)) return null;

    const normalizedMessages: LumiereMessage[] = messages
      .filter((message): message is LumiereMessage => {
        return (
          typeof message === "object" &&
          message !== null &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.text === "string" &&
          typeof message.createdAt === "number" &&
          typeof message.id === "string"
        );
      })
      .map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
        createdAt: message.createdAt,
        suggestions: Array.isArray(message.suggestions)
          ? message.suggestions
          : undefined,
      }));

    return {
      locale,
      speak,
      userName,
      messages: normalizedMessages,
    };
  } catch {
    return null;
  }
}

function writePersistedState(state: LumiereState): void {
  if (!isBrowser()) return;

  const data: LumierePersistedState = {
    locale: state.locale,
    speak: state.speak,
    userName: state.userName,
    messages: state.messages,
  };

  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silent fail: storage can be unavailable in some environments.
  }
}

function clearPersistedState(): void {
  if (!isBrowser()) return;

  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Silent fail
  }
}

const persisted = readPersistedState();

const initialState: LumiereState = {
  isOpen: false,
  locale: persisted?.locale ?? "en",
  speak: persisted?.speak ?? false,
  userName: persisted?.userName ?? null,
  messages: persisted?.messages ?? [],
  status: "idle",
};

export const sendLumiereMessage = createAsyncThunk<
  LumiereReplyResult,
  SendLumiereMessagePayload,
  { rejectValue: string }
>("lumiere/sendLumiereMessage", async (payload, thunkApi) => {
  try {
    return await lumiereReply({
      text: payload.text,
      locale: payload.locale,
      userName: payload.userName,
      page: payload.page,
      history: payload.history,
    });
  } catch {
    return thunkApi.rejectWithValue("Request failed");
  }
});

const lumiereSlice = createSlice({
  name: "lumiere",
  initialState,
  reducers: {
    toggle(state) {
      state.isOpen = !state.isOpen;
    },

    close(state) {
      state.isOpen = false;
    },

    open(state) {
      state.isOpen = true;
    },

    setLocale(state, action: PayloadAction<Locale>) {
      state.locale = action.payload;
      writePersistedState(state);
    },

    setSpeak(state, action: PayloadAction<boolean>) {
      state.speak = action.payload;
      writePersistedState(state);
    },

    setUserName(state, action: PayloadAction<string | null>) {
      state.userName = action.payload;
      writePersistedState(state);
    },

    addUserMessage(state, action: PayloadAction<string>) {
      state.messages.push(createMessage("user", action.payload));
      writePersistedState(state);
    },

    ensureGreeting(state, action: PayloadAction<EnsureGreetingPayload>) {
      if (state.messages.length > 0) return;

      const firstName =
        action.payload.isLoggedIn && action.payload.firstName
          ? action.payload.firstName
          : null;

      state.messages.push(
        createMessage("assistant", getGreetingText(state.locale, firstName))
      );

      if (firstName && !state.userName) {
        state.userName = firstName;
      }

      writePersistedState(state);
    },

    clearConversation(state) {
      state.messages = [];
      state.status = "idle";
      clearPersistedState();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendLumiereMessage.pending, (state) => {
        state.status = "loading";
      })
      .addCase(sendLumiereMessage.fulfilled, (state, action) => {
        state.status = "idle";
        state.messages.push(
          createMessage(
            "assistant",
            action.payload.text,
            action.payload.suggestions
          )
        );
        writePersistedState(state);
      })
      .addCase(sendLumiereMessage.rejected, (state) => {
        state.status = "failed";
        state.messages.push(
          createMessage(
            "assistant",
            state.locale === "ru"
              ? "Извини, я не смогла ответить прямо сейчас. Попробуй ещё раз."
              : state.locale === "es"
              ? "Lo siento, no pude responder ahora mismo. Inténtalo de nuevo."
              : state.locale === "fr"
              ? "Désolée, je n’ai pas pu répondre pour le moment. Réessayez."
              : "Sorry, I couldn’t reply right now. Please try again."
          )
        );
        writePersistedState(state);
      });
  },
});

export const {
  addUserMessage,
  clearConversation,
  close,
  ensureGreeting,
  open,
  setLocale,
  setSpeak,
  setUserName,
  toggle,
} = lumiereSlice.actions;

export default lumiereSlice.reducer;