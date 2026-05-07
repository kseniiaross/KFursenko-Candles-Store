import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";

import { sendLumiereReply } from "../api/lumiere";

import type {
  Locale,
  LumiereHistoryMessage,
  LumiereMessage,
  LumierePersistedState,
  LumiereReplyResult,
  LumiereStatus,
} from "../types/lumiere";

const SESSION_STORAGE_KEY = "lumiere_session_v1";

/* ================= TYPES ================= */

type LumiereState = {
  isOpen: boolean;
  locale: Locale;
  speak: boolean;
  userName: string | null;
  messages: LumiereMessage[];
  status: LumiereStatus;
};

type SendPayload = {
  text: string;
  locale: Locale;
  userName: string | null;
  history: LumiereHistoryMessage[];
  page?: string;
};

/* ================= HELPERS ================= */

const isBrowser = (): boolean => typeof window !== "undefined";

const createId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `lumiere-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createMessage = (
  role: "user" | "assistant",
  text: string,
  suggestions?: LumiereReplyResult["suggestions"]
): LumiereMessage => ({
  id: createId(),
  role,
  text,
  createdAt: Date.now(),
  suggestions,
});

/* ================= STORAGE ================= */

const readStorage = (): LumierePersistedState | null => {
  if (!isBrowser()) return null;

  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LumierePersistedState>;

    if (
      !parsed ||
      !["en", "ru", "es", "fr"].includes(String(parsed.locale)) ||
      typeof parsed.speak !== "boolean" ||
      !Array.isArray(parsed.messages)
    ) {
      return null;
    }

    return parsed as LumierePersistedState;
  } catch {
    return null;
  }
};

const writeStorage = (state: LumiereState): void => {
  if (!isBrowser()) return;

  const data: LumierePersistedState = {
    locale: state.locale,
    speak: state.speak,
    userName: state.userName,
    messages: state.messages,
  };

  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage failures.
  }
};

const clearStorage = (): void => {
  if (!isBrowser()) return;

  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

/* ================= INITIAL ================= */

const persisted = readStorage();

const initialState: LumiereState = {
  isOpen: false,
  locale: persisted?.locale ?? "en",
  speak: persisted?.speak ?? false,
  userName: persisted?.userName ?? null,
  messages: persisted?.messages ?? [],
  status: "idle",
};

/* ================= ASYNC ================= */

export const sendLumiereMessage = createAsyncThunk<
  LumiereReplyResult,
  SendPayload,
  { rejectValue: string }
>("lumiere/send", async (payload, thunkApi) => {
  try {
    const response = await sendLumiereReply({
      text: payload.text,
      locale: payload.locale,
      userName: payload.userName,
      page: payload.page ?? "",
      history: payload.history,
    });

    return {
      text: response.text,
      suggestions: response.suggestions ?? [],
    };
  } catch {
    return thunkApi.rejectWithValue("Request failed");
  }
});

/* ================= SLICE ================= */

const lumiereSlice = createSlice({
  name: "lumiere",
  initialState,
  reducers: {
    toggle: (state) => {
      state.isOpen = !state.isOpen;
    },

    open: (state) => {
      state.isOpen = true;
    },

    close: (state) => {
      state.isOpen = false;
    },

    setLocale: (state, action: PayloadAction<Locale>) => {
      state.locale = action.payload;
      writeStorage(state);
    },

    setSpeak: (state, action: PayloadAction<boolean>) => {
      state.speak = action.payload;
      writeStorage(state);
    },

    setUserName: (state, action: PayloadAction<string | null>) => {
      state.userName = action.payload;
      writeStorage(state);
    },

    addUserMessage: (state, action: PayloadAction<string>) => {
      state.messages.push(createMessage("user", action.payload));
      writeStorage(state);
    },

    ensureGreeting: (
      state,
      action: PayloadAction<{ isLoggedIn: boolean; firstName: string | null }>
    ) => {
      if (state.messages.length > 0) return;

      const name = action.payload.isLoggedIn ? action.payload.firstName : null;

      const text =
        state.locale === "ru"
          ? `Здравствуйте${name ? `, ${name}` : ""}. Я Lumière. Помогу подобрать свечу.`
          : `Hello${name ? `, ${name}` : ""}. I’m Lumière. I can help you choose a candle.`;

      state.messages.push(createMessage("assistant", text));

      if (name && !state.userName) {
        state.userName = name;
      }

      writeStorage(state);
    },

    clearConversation: (state) => {
      state.messages = [];
      state.status = "idle";
      clearStorage();
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
        writeStorage(state);
      })

      .addCase(sendLumiereMessage.rejected, (state) => {
        state.status = "failed";

        const errorText =
          state.locale === "ru"
            ? "Ошибка. Попробуйте снова."
            : "Something went wrong. Try again.";

        state.messages.push(createMessage("assistant", errorText));
        writeStorage(state);
      });
  },
});

export const {
  toggle,
  open,
  close,
  setLocale,
  setSpeak,
  setUserName,
  addUserMessage,
  ensureGreeting,
  clearConversation,
} = lumiereSlice.actions;

export default lumiereSlice.reducer;