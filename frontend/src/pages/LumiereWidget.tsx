import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  addUserMessage,
  clearConversation,
  close,
  ensureGreeting,
  sendLumiereMessage,
  setLocale,
  setSpeak,
  setUserName,
  toggle,
} from "../store/lumiereSlice";

import type {
  Locale,
  LumiereHistoryMessage,
  LumiereMessage,
} from "../types/lumiere";

import "../styles/LumiereWidget.css";

const SPEECH_LANG: Record<Locale, string> = {
  en: "en-US",
  ru: "ru-RU",
  es: "es-ES",
  fr: "fr-FR",
};

const PREFERRED_VOICE_KEYWORDS: Record<Locale, string[]> = {
  en: ["samantha", "google us english", "microsoft aria", "alex"],
  ru: ["milena", "yuri", "google русский", "microsoft svetlana"],
  es: ["monica", "google español", "microsoft elvira"],
  fr: ["amelie", "thomas", "google français", "microsoft denise"],
};

function stopSpeaking(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

function cleanSpeechText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[•●◆▪️]/g, ". ")
    .replace(/[✨🕯️🎁💡🔥]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSpeechText(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];

  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function getBestVoice(locale: Locale): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  const lang = SPEECH_LANG[locale].toLowerCase();
  const preferredKeywords = PREFERRED_VOICE_KEYWORDS[locale];

  for (const keyword of preferredKeywords) {
    const preferredVoice = voices.find((voice) =>
      voice.name.toLowerCase().includes(keyword)
    );

    if (preferredVoice) return preferredVoice;
  }

  return (
    voices.find((voice) => voice.lang.toLowerCase() === lang) ??
    voices.find((voice) =>
      voice.lang.toLowerCase().startsWith(lang.slice(0, 2))
    ) ??
    null
  );
}

function speakText(text: string, locale: Locale): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const cleanText = cleanSpeechText(text);
  if (!cleanText) return;

  const synth = window.speechSynthesis;
  const voice = getBestVoice(locale);
  const chunks = splitSpeechText(cleanText);

  synth.cancel();

  chunks.forEach((chunk) => {
    const utterance = new SpeechSynthesisUtterance(chunk);

    utterance.lang = SPEECH_LANG[locale];

    if (voice) {
      utterance.voice = voice;
    }

    utterance.rate = locale === "ru" ? 0.82 : 0.88;
    utterance.pitch = 0.92;
    utterance.volume = 1;

    synth.speak(utterance);
  });
}

function formatTime(timestamp: number, locale: Locale): string {
  const date = new Date(timestamp);

  const localeMap: Record<Locale, string> = {
    en: "en-US",
    ru: "ru-RU",
    es: "es-ES",
    fr: "fr-FR",
  };

  return date.toLocaleTimeString(localeMap[locale], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildHistory(messages: LumiereMessage[]): LumiereHistoryMessage[] {
  return messages.map((message) => ({
    role: message.role,
    text: message.text,
  }));
}

function getLastAssistantMessage(
  messages: LumiereMessage[]
): LumiereMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "assistant") {
      return messages[index];
    }
  }

  return null;
}

const LumiereWidget: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const isOpen = useAppSelector((state) => state.lumiere.isOpen);
  const locale = useAppSelector((state) => state.lumiere.locale);
  const speak = useAppSelector((state) => state.lumiere.speak);
  const userName = useAppSelector((state) => state.lumiere.userName);
  const messages = useAppSelector((state) => state.lumiere.messages);
  const status = useAppSelector((state) => state.lumiere.status);

  const isLoggedIn = useAppSelector((state) => Boolean(state.auth?.isLoggedIn));
  const firstName = useAppSelector(
    (state) => (state.auth?.user?.first_name ?? null) as string | null
  );

  const [input, setInput] = useState("");

  const panelRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);

  const dialogTitleId = useId();
  const dialogDescId = useId();
  const messageInputId = useId();
  const languageSelectId = useId();
  const messageListId = useId();

  useEffect(() => {
    if (!isOpen) return;

    dispatch(ensureGreeting({ isLoggedIn, firstName }));
  }, [dispatch, isOpen, isLoggedIn, firstName]);

  useEffect(() => {
    if (!isOpen) return;

    const listElement = listRef.current;
    if (!listElement) return;

    listElement.scrollTop = listElement.scrollHeight;
  }, [isOpen, messages.length, status]);

  useEffect(() => {
    if (!isOpen) return;

    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;

    openButtonRef.current?.focus();
    stopSpeaking();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        stopSpeaking();
        dispatch(close());
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dispatch, isOpen]);

  const onSend = async (): Promise<void> => {
    const text = input.trim();

    if (!text || status === "loading") return;

    const currentHistory = buildHistory(messages);

    setInput("");
    dispatch(addUserMessage(text));

    let effectiveUserName = userName;

    if (!isLoggedIn && !userName) {
      if (text.length >= 2 && text.length <= 40 && !text.includes(" ")) {
        effectiveUserName = text;
        dispatch(setUserName(text));
      }
    }

    const nextHistory: LumiereHistoryMessage[] = [
      ...currentHistory,
      { role: "user", text },
    ];

    const result = await dispatch(
      sendLumiereMessage({
        text,
        locale,
        userName: effectiveUserName,
        history: nextHistory,
      })
    );

    if (sendLumiereMessage.fulfilled.match(result) && speak) {
      speakText(result.payload.text, locale);
    }
  };

  const onInputKeyDown: React.KeyboardEventHandler<HTMLInputElement> = async (
    event
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await onSend();
    }
  };

  const onLocaleChange = (value: Locale): void => {
    stopSpeaking();
    dispatch(setLocale(value));
  };

  const onSpeechToggle = (): void => {
    const nextSpeakValue = !speak;

    dispatch(setSpeak(nextSpeakValue));

    if (!nextSpeakValue) {
      stopSpeaking();
      return;
    }

    const lastAssistantMessage = getLastAssistantMessage(messages);

    if (lastAssistantMessage) {
      speakText(lastAssistantMessage.text, locale);
    }
  };

  const onClearConversation = (): void => {
    stopSpeaking();
    dispatch(clearConversation());
    setInput("");
  };

  const openLabel = isOpen ? t("lumiere.close") : t("lumiere.open");
  const speechLabel = speak ? t("lumiere.speechOff") : t("lumiere.speechOn");

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        className="lumiereFab"
        onClick={() => dispatch(toggle())}
        aria-label={openLabel}
        aria-expanded={isOpen}
        aria-controls={isOpen ? dialogTitleId : undefined}
      >
        <span className="lumiereFab__icon" aria-hidden="true">
          ✨
        </span>
      </button>

      {isOpen ? (
        <section
          ref={panelRef}
          className="lumierePanel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          aria-describedby={dialogDescId}
        >
          <header className="lumiereHeader">
            <div className="lumiereHeader__left">
              <h2 id={dialogTitleId} className="lumiereTitle">
                Lumière
              </h2>

              <p id={dialogDescId} className="lumiereSub">
                {t("lumiere.subtitle")}
              </p>
            </div>

            <div className="lumiereHeader__right">
              <div className="lumiereField">
                <label className="lumiereSrOnly" htmlFor={languageSelectId}>
                  {t("lumiere.language")}
                </label>

                <select
                  id={languageSelectId}
                  className="lumiereSelect"
                  value={locale}
                  onChange={(event) =>
                    onLocaleChange(event.target.value as Locale)
                  }
                  aria-label={t("lumiere.language")}
                >
                  <option value="en">EN</option>
                  <option value="ru">RU</option>
                  <option value="es">ES</option>
                  <option value="fr">FR</option>
                </select>
              </div>

              <button
                type="button"
                className={`lumiereVoiceButton ${speak ? "is-active" : ""}`}
                onClick={onSpeechToggle}
                aria-label={speechLabel}
                aria-pressed={speak}
                title={speechLabel}
              >
                <span aria-hidden="true">🔊</span>
              </button>

              <button
                type="button"
                className="lumiereClear"
                onClick={onClearConversation}
              >
                {t("lumiere.clear")}
              </button>

              <button
                type="button"
                className="lumiereClose"
                onClick={() => {
                  stopSpeaking();
                  dispatch(close());
                }}
                aria-label={t("lumiere.close")}
              >
                ×
              </button>
            </div>
          </header>

          <div
            ref={listRef}
            id={messageListId}
            className="lumiereBody"
            aria-label={t("lumiere.messages")}
            aria-live="polite"
            aria-relevant="additions text"
          >
            {messages.map((message: LumiereMessage) => (
              <div
                key={message.id}
                className={`lumiereMsg ${
                  message.role === "user" ? "is-user" : "is-assistant"
                }`}
              >
                <div className="lumiereBubble">
                  <div className="lumiereText">{message.text}</div>

                  {message.suggestions && message.suggestions.length > 0 ? (
                    <div
                      className="lumiereSuggest"
                      aria-label={t("lumiere.suggestedProducts")}
                    >
                      {message.suggestions.map((product) => (
                        <Link
                          key={product.id}
                          to={`/catalog/item/${product.slug}`}
                          className="lumiereCard"
                          aria-label={t("lumiere.openProduct", {
                            name: product.name,
                          })}
                        >
                          <div className="lumiereCard__top">
                            <div className="lumiereCard__name">
                              {product.name}
                            </div>

                            <div className="lumiereCard__price">
                              {product.price
                                ? t("lumiere.fromPrice", {
                                    price: product.price,
                                  })
                                : t("lumiere.seeProduct")}
                            </div>
                          </div>

                          <div className="lumiereCard__meta">
                            {product.in_stock
                              ? t("lumiere.inStock")
                              : t("lumiere.soldOut")}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="lumiereTime">
                  {formatTime(message.createdAt, locale)}
                </div>
              </div>
            ))}

            {status === "loading" ? (
              <div className="lumiereTyping" aria-label={t("lumiere.typing")}>
                {t("lumiere.typing")}
              </div>
            ) : null}
          </div>

          <footer className="lumiereFooter">
            <label className="lumiereSrOnly" htmlFor={messageInputId}>
              {t("lumiere.input")}
            </label>

            <input
              ref={inputRef}
              id={messageInputId}
              className="lumiereInput"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder={t("lumiere.placeholder")}
              aria-label={t("lumiere.input")}
              aria-controls={messageListId}
              autoComplete="off"
            />

            <button
              type="button"
              className="lumiereSend"
              onClick={() => {
                void onSend();
              }}
              disabled={!input.trim() || status === "loading"}
            >
              {t("lumiere.send")}
            </button>
          </footer>
        </section>
      ) : null}
    </>
  );
};

export default LumiereWidget;