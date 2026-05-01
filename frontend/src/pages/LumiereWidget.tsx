import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

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

function stopSpeaking(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

function speakText(text: string, locale: Locale): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const cleanText = text.trim();
  if (!cleanText) return;

  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(cleanText);

  if (locale === "ru") utterance.lang = "ru-RU";
  else if (locale === "es") utterance.lang = "es-ES";
  else if (locale === "fr") utterance.lang = "fr-FR";
  else utterance.lang = "en-US";

  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  synth.speak(utterance);
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

function getLastAssistantMessage(messages: LumiereMessage[]): LumiereMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "assistant") {
      return messages[index];
    }
  }

  return null;
}

const LumiereWidget: React.FC = () => {
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

  const title = "Lumière";

  const localizedText = useMemo(() => {
    if (locale === "ru") {
      return {
        open: "Открыть ассистента Lumière",
        close: "Закрыть ассистента Lumière",
        subtitle: "Ваш помощник по свечам",
        language: "Язык",
        speechOn: "Включить озвучивание ответов",
        speechOff: "Выключить озвучивание ответов",
        messages: "Сообщения чата",
        input: "Введите сообщение",
        placeholder: "Спроси про аромат, доставку, уход…",
        send: "Отправить",
        clear: "Новый чат",
        typing: "Lumière печатает…",
        suggestedProducts: "Рекомендованные товары",
        inStock: "В наличии",
        soldOut: "Нет в наличии",
        openProduct: "Открыть товар {{name}}",
      };
    }

    if (locale === "es") {
      return {
        open: "Abrir asistente Lumière",
        close: "Cerrar asistente Lumière",
        subtitle: "Tu asistente de velas",
        language: "Idioma",
        speechOn: "Activar lectura en voz alta",
        speechOff: "Desactivar lectura en voz alta",
        messages: "Mensajes del chat",
        input: "Escribe un mensaje",
        placeholder: "Pregunta sobre aroma, envío, cuidado…",
        send: "Enviar",
        clear: "Nuevo chat",
        typing: "Lumière está escribiendo…",
        suggestedProducts: "Productos sugeridos",
        inStock: "Disponible",
        soldOut: "Agotado",
        openProduct: "Abrir producto {{name}}",
      };
    }

    if (locale === "fr") {
      return {
        open: "Ouvrir l’assistant Lumière",
        close: "Fermer l’assistant Lumière",
        subtitle: "Votre assistante bougies",
        language: "Langue",
        speechOn: "Activer la lecture vocale",
        speechOff: "Désactiver la lecture vocale",
        messages: "Messages du chat",
        input: "Saisir un message",
        placeholder: "Demandez un parfum, la livraison, l’entretien…",
        send: "Envoyer",
        clear: "Nouveau chat",
        typing: "Lumière écrit…",
        suggestedProducts: "Produits suggérés",
        inStock: "En stock",
        soldOut: "Rupture de stock",
        openProduct: "Ouvrir le produit {{name}}",
      };
    }

    return {
      open: "Open Lumière assistant",
      close: "Close Lumière assistant",
      subtitle: "Your candle assistant",
      language: "Language",
      speechOn: "Turn on voice playback",
      speechOff: "Turn off voice playback",
      messages: "Chat messages",
      input: "Enter message",
      placeholder: "Ask about scent, shipping, care…",
      send: "Send",
      clear: "New chat",
      typing: "Lumière is typing…",
      suggestedProducts: "Suggested products",
      inStock: "In stock",
      soldOut: "Sold out",
      openProduct: "Open product {{name}}",
    };
  }, [locale]);

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

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        className="lumiereFab"
        onClick={() => dispatch(toggle())}
        aria-label={isOpen ? localizedText.close : localizedText.open}
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
                {title}
              </h2>

              <p id={dialogDescId} className="lumiereSub">
                {localizedText.subtitle}
              </p>
            </div>

            <div className="lumiereHeader__right">
              <div className="lumiereField">
                <label className="lumiereSrOnly" htmlFor={languageSelectId}>
                  {localizedText.language}
                </label>

                <select
                  id={languageSelectId}
                  className="lumiereSelect"
                  value={locale}
                  onChange={(event) =>
                    onLocaleChange(event.target.value as Locale)
                  }
                  aria-label={localizedText.language}
                >
                  <option value="en">EN</option>
                  <option value="ru">RU</option>
                  <option value="es">ES</option>
                  <option value="fr">FR</option>
                </select>
              </div>

              <button
                type="button"
                className={`lumiereVoiceButton ${
                  speak ? "is-active" : ""
                }`}
                onClick={onSpeechToggle}
                aria-label={speak ? localizedText.speechOff : localizedText.speechOn}
                aria-pressed={speak}
                title={speak ? localizedText.speechOff : localizedText.speechOn}
              >
                <span aria-hidden="true">🔊</span>
              </button>

              <button
                type="button"
                className="lumiereClear"
                onClick={onClearConversation}
              >
                {localizedText.clear}
              </button>

              <button
                type="button"
                className="lumiereClose"
                onClick={() => {
                  stopSpeaking();
                  dispatch(close());
                }}
                aria-label={localizedText.close}
              >
                ×
              </button>
            </div>
          </header>

          <div
            ref={listRef}
            id={messageListId}
            className="lumiereBody"
            aria-label={localizedText.messages}
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
                      aria-label={localizedText.suggestedProducts}
                    >
                      {message.suggestions.map((product) => (
                        <Link
                          key={product.id}
                          to={`/catalog/item/${product.slug}`}
                          className="lumiereCard"
                          aria-label={localizedText.openProduct.replace(
                            "{{name}}",
                            product.name
                          )}
                        >
                          <div className="lumiereCard__top">
                            <div className="lumiereCard__name">
                              {product.name}
                            </div>

                            <div className="lumiereCard__price">
                              {product.price
                                ? `From $${product.price}`
                                : "See product"}
                            </div>
                          </div>

                          <div className="lumiereCard__meta">
                            {product.in_stock
                              ? localizedText.inStock
                              : localizedText.soldOut}
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
              <div className="lumiereTyping" aria-label={localizedText.typing}>
                {localizedText.typing}
              </div>
            ) : null}
          </div>

          <footer className="lumiereFooter">
            <label className="lumiereSrOnly" htmlFor={messageInputId}>
              {localizedText.input}
            </label>

            <input
              ref={inputRef}
              id={messageInputId}
              className="lumiereInput"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder={localizedText.placeholder}
              aria-label={localizedText.input}
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
              {localizedText.send}
            </button>
          </footer>
        </section>
      ) : null}
    </>
  );
};

export default LumiereWidget;