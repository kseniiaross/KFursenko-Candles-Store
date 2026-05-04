import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";

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

const isBrowser = () => typeof window !== "undefined";

const createId = () =>
  crypto?.randomUUID?.() ??
  `lumiere-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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

    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      !["en", "ru", "es", "fr"].includes(parsed.locale) ||
      typeof parsed.speak !== "boolean" ||
      !Array.isArray(parsed.messages)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const writeStorage = (state: LumiereState) => {
  if (!isBrowser()) return;

  const data: LumierePersistedState = {
    locale: state.locale,
    speak: state.speak,
    userName: state.userName,
    messages: state.messages,
  };

  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch {}
};

const clearStorage = () => {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
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
    return await lumiereReply(payload);
  } catch {
    return thunkApi.rejectWithValue("Request failed");
  }
});

/* ================= SLICE ================= */

const lumiereSlice = createSlice({
  name: "lumiere",
  initialState,
  reducers: {
    toggle: (s) => {
      s.isOpen = !s.isOpen;
    },

    open: (s) => {
      s.isOpen = true;
    },

    close: (s) => {
      s.isOpen = false;
    },

    setLocale: (s, a: PayloadAction<Locale>) => {
      s.locale = a.payload;
      writeStorage(s);
    },

    setSpeak: (s, a: PayloadAction<boolean>) => {
      s.speak = a.payload;
      writeStorage(s);
    },

    setUserName: (s, a: PayloadAction<string | null>) => {
      s.userName = a.payload;
      writeStorage(s);
    },

    addUserMessage: (s, a: PayloadAction<string>) => {
      s.messages.push(createMessage("user", a.payload));
      writeStorage(s);
    },

    ensureGreeting: (
      s,
      a: PayloadAction<{ isLoggedIn: boolean; firstName: string | null }>
    ) => {
      if (s.messages.length > 0) return;

      const name = a.payload.isLoggedIn ? a.payload.firstName : null;

      const text =
        s.locale === "ru"
          ? `Здравствуйте${name ? `, ${name}` : ""}. Я Lumière. Помогу подобрать свечу.`
          : `Hello${name ? `, ${name}` : ""}. I’m Lumière. I can help you choose a candle.`;

      s.messages.push(createMessage("assistant", text));

      if (name && !s.userName) s.userName = name;

      writeStorage(s);
    },

    clearConversation: (s) => {
      s.messages = [];
      s.status = "idle";
      clearStorage();
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(sendLumiereMessage.pending, (s) => {
        s.status = "loading";
      })

      .addCase(sendLumiereMessage.fulfilled, (s, a) => {
        s.status = "idle";
        s.messages.push(
          createMessage("assistant", a.payload.text, a.payload.suggestions)
        );
        writeStorage(s);
      })

      .addCase(sendLumiereMessage.rejected, (s) => {
        s.status = "failed";

        const errorText =
          s.locale === "ru"
            ? "Ошибка. Попробуйте снова."
            : "Something went wrong. Try again.";

        s.messages.push(createMessage("assistant", errorText));
        writeStorage(s);
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