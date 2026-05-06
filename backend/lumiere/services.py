import json
import logging
import re
from decimal import Decimal
from typing import Any, Dict, List, Optional

import requests
from django.conf import settings
from django.db.models import Prefetch, Q

from candles.models import Candle, CandleVariant

logger = logging.getLogger(__name__)

HISTORY_WINDOW = 10
AI_SEARCH_CATALOG_LIMIT = 80

SUPPORTED_LOCALES = {"en", "ru", "es", "fr"}

PRODUCT_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?kfcandle\.com/catalog/(?:item/)?(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)",
    re.IGNORECASE,
)


def _t(locale: str, en: str, ru: str, es: str, fr: str) -> str:
    if locale == "ru":
        return ru
    if locale == "es":
        return es
    if locale == "fr":
        return fr
    return en


def _safe_locale(locale: str) -> str:
    clean_locale = (locale or "en").lower().strip()
    return clean_locale if clean_locale in SUPPORTED_LOCALES else "en"


def _localized_value(candle: Candle, field_name: str, locale: str) -> str:
    safe_locale = _safe_locale(locale)
    translated = getattr(candle, f"{field_name}_{safe_locale}", "") or ""
    fallback = getattr(candle, field_name, "") or ""
    return translated.strip() or fallback


def _format_price(value: Decimal | None) -> str:
    if value is None:
        return ""
    return f"{value:.2f}"


def _join_list(values: List[str] | None) -> str:
    if not values:
        return ""
    return ", ".join(v.strip() for v in values if isinstance(v, str) and v.strip())


def _normalize_text(value: str) -> str:
    text = (value or "").lower().strip()
    text = re.sub(r"https?://\S+", " ", text)
    text = text.replace("/catalog/item/", " ")
    text = text.replace("/catalog/", " ")
    text = re.sub(
        r"[^a-zа-яёáéíóúüñçàâêîôûëïü0-9\s\-_]+",
        " ",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _extract_text_from_responses_api(payload: Dict[str, Any]) -> str:
    output_text = payload.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    text_parts: List[str] = []
    output = payload.get("output", [])

    if isinstance(output, list):
        for item in output:
            if not isinstance(item, dict):
                continue

            if item.get("type") != "message":
                continue

            content = item.get("content", [])
            if not isinstance(content, list):
                continue

            for chunk in content:
                if not isinstance(chunk, dict):
                    continue

                if chunk.get("type") in ("output_text", "text"):
                    text = chunk.get("text")
                    if isinstance(text, str) and text.strip():
                        text_parts.append(text.strip())

    return "\n".join(text_parts).strip()


def _get_active_variants(candle: Candle) -> List[CandleVariant]:
    prefetched = getattr(candle, "prefetched_active_variants", None)
    if prefetched is not None:
        return list(prefetched)

    return list(candle.variants.filter(is_active=True).order_by("price", "id"))


def _get_display_price(candle: Candle) -> str:
    variants = _get_active_variants(candle)

    priced_variants = [variant for variant in variants if variant.price is not None]
    if priced_variants:
        return _format_price(min(variant.price for variant in priced_variants))

    if candle.price is not None:
        return _format_price(candle.price)

    return ""


def _is_candle_available(candle: Candle) -> bool:
    if candle.is_sold_out:
        return False

    variants = _get_active_variants(candle)
    if variants:
        return any(variant.stock_qty > 0 for variant in variants)

    return False


def _base_candle_queryset():
    return (
        Candle.objects.select_related("category")
        .prefetch_related(
            "collections",
            "images",
            Prefetch(
                "variants",
                queryset=CandleVariant.objects.filter(is_active=True).order_by(
                    "price",
                    "id",
                ),
                to_attr="prefetched_active_variants",
            ),
        )
    )


def _serialize_candle(
    candle: Candle,
    locale: str = "en",
    match_reason: str = "",
) -> Dict[str, Any]:
    return {
        "id": candle.id,
        "name": _localized_value(candle, "name", locale),
        "slug": candle.slug,
        "price": _get_display_price(candle),
        "in_stock": _is_candle_available(candle),
        "description": _localized_value(candle, "description", locale),
        "fragrance_family": getattr(candle, "fragrance_family", "") or "",
        "intensity": getattr(candle, "intensity", "") or "",
        "top_notes": getattr(candle, "top_notes", []) or [],
        "heart_notes": getattr(candle, "heart_notes", []) or [],
        "base_notes": getattr(candle, "base_notes", []) or [],
        "mood_tags": getattr(candle, "mood_tags", []) or [],
        "use_case_tags": getattr(candle, "use_case_tags", []) or [],
        "ideal_spaces": getattr(candle, "ideal_spaces", []) or [],
        "season_tags": getattr(candle, "season_tags", []) or [],
        "match_reason": match_reason,
    }


def _compact_candle_for_ai(candle: Candle, locale: str) -> Dict[str, Any]:
    variants = _get_active_variants(candle)

    return {
        "id": candle.id,
        "name": _localized_value(candle, "name", locale),
        "slug": candle.slug,
        "description": _localized_value(candle, "description", locale)[:700],
        "price_from": _get_display_price(candle),
        "in_stock": _is_candle_available(candle),
        "is_bestseller": candle.is_bestseller,
        "fragrance_family": getattr(candle, "fragrance_family", "") or "",
        "intensity": getattr(candle, "intensity", "") or "",
        "top_notes": getattr(candle, "top_notes", []) or [],
        "heart_notes": getattr(candle, "heart_notes", []) or [],
        "base_notes": getattr(candle, "base_notes", []) or [],
        "mood_tags": getattr(candle, "mood_tags", []) or [],
        "use_case_tags": getattr(candle, "use_case_tags", []) or [],
        "ideal_spaces": getattr(candle, "ideal_spaces", []) or [],
        "season_tags": getattr(candle, "season_tags", []) or [],
        "variants": [
            {
                "id": variant.id,
                "size": variant.size,
                "price": _format_price(variant.price),
                "stock_qty": variant.stock_qty,
            }
            for variant in variants
        ],
    }


def _build_ai_catalog(locale: str) -> List[Dict[str, Any]]:
    candles = (
        _base_candle_queryset()
        .filter(is_sold_out=False)
        .order_by("-is_bestseller", "-created_at")[:AI_SEARCH_CATALOG_LIMIT]
    )

    return [_compact_candle_for_ai(candle, locale) for candle in candles]


def _extract_json_object(text: str) -> Dict[str, Any]:
    clean = (text or "").strip()

    if clean.startswith("```"):
        clean = re.sub(r"^```(?:json)?", "", clean).strip()
        clean = re.sub(r"```$", "", clean).strip()

    try:
        parsed = json.loads(clean)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", clean, flags=re.DOTALL)
    if not match:
        return {}

    try:
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _openai_headers(api_key: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def _call_openai_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    api_key = (getattr(settings, "OPENAI_API_KEY", "") or "").strip()
    timeout_s = int(getattr(settings, "OPENAI_TIMEOUT_SECONDS", 25))

    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is missing.")

    response = requests.post(
        "https://api.openai.com/v1/responses",
        headers=_openai_headers(api_key),
        json=payload,
        timeout=timeout_s,
    )
    response.raise_for_status()
    return response.json()


def ai_search_candles(
    query: str,
    limit: int = 6,
    locale: str = "en",
) -> Dict[str, Any]:
    safe_locale = _safe_locale(locale)
    clean_query = (query or "").strip()

    if not clean_query:
        return {
            "query": query,
            "text": "",
            "suggestions": [],
        }

    catalog = _build_ai_catalog(safe_locale)

    if not catalog:
        return {
            "query": clean_query,
            "text": _t(
                safe_locale,
                "I could not find any candles in the catalog right now.",
                "Сейчас я не нашла свечей в каталоге.",
                "Ahora mismo no encontré velas en el catálogo.",
                "Je n'ai trouvé aucune bougie dans le catalogue pour le moment.",
            ),
            "suggestions": [],
        }

    model = (getattr(settings, "OPENAI_MODEL", "") or "gpt-4.1-mini").strip()

    instructions = f"""
You are Lumière AI Search for a premium handmade candle boutique.

Your job:
- Understand the customer's search intent.
- Select the best matching products ONLY from the provided catalog.
- Do not invent products, prices, stock, notes, or policies.
- Prefer in-stock products.
- If the request is vague, still choose the best likely matches.
- Reply in locale: {safe_locale}.

Return ONLY valid JSON with this exact shape:
{{
  "text": "short premium explanation for the customer",
  "product_ids": [1, 2, 3],
  "reasons": {{
    "1": "short reason",
    "2": "short reason"
  }}
}}

Rules:
- product_ids must be real ids from the catalog.
- product_ids length must be between 0 and {limit}.
- text should be 2-4 sentences.
- reasons should explain why each selected product fits the intent.
"""

    full_input = {
        "customer_query": clean_query,
        "catalog": catalog,
    }

    payload = {
        "model": model,
        "instructions": instructions,
        "input": json.dumps(full_input, ensure_ascii=False),
        "temperature": 0.25,
    }

    try:
        data = _call_openai_payload(payload)
        raw_text = _extract_text_from_responses_api(data)
        parsed = _extract_json_object(raw_text)

        product_ids_raw = parsed.get("product_ids", [])
        reasons_raw = parsed.get("reasons", {})
        explanation = parsed.get("text", "")

        product_ids = [
            int(product_id)
            for product_id in product_ids_raw
            if str(product_id).isdigit()
        ][:limit]

        reasons = reasons_raw if isinstance(reasons_raw, dict) else {}

        if not product_ids:
            return {
                "query": clean_query,
                "text": explanation
                or _t(
                    safe_locale,
                    "I could not find a strong match. Try describing the mood, room, or scent family you want.",
                    "Я не нашла сильного совпадения. Попробуй описать настроение, комнату или тип аромата.",
                    "No encontré una coincidencia fuerte. Intenta describir el ambiente, la habitación o la familia olfativa.",
                    "Je n'ai pas trouvé de correspondance forte. Essaie de décrire l'ambiance, la pièce ou la famille olfactive.",
                ),
                "suggestions": [],
            }

        candles = list(
            _base_candle_queryset().filter(id__in=product_ids)
        )
        candle_map = {candle.id: candle for candle in candles}

        suggestions = []
        for product_id in product_ids:
            candle = candle_map.get(product_id)
            if not candle:
                continue

            reason = str(reasons.get(str(product_id), "") or "")
            suggestions.append(
                _serialize_candle(
                    candle,
                    locale=safe_locale,
                    match_reason=reason,
                )
            )

        return {
            "query": clean_query,
            "text": explanation,
            "suggestions": suggestions,
        }

    except Exception:
        logger.exception("Lumiere AI Search failed. Falling back to local search.")

        fallback = search_candles(clean_query, limit=limit, locale=safe_locale)

        return {
            "query": clean_query,
            "text": _t(
                safe_locale,
                "AI search had a temporary issue, so I used the closest catalog matches.",
                "У AI-поиска временная ошибка, поэтому я показала ближайшие совпадения из каталога.",
                "La búsqueda con IA tuvo un problema temporal, así que usé las coincidencias más cercanas del catálogo.",
                "La recherche IA a rencontré un problème temporaire, donc j'ai utilisé les meilleures correspondances du catalogue.",
            ),
            "suggestions": fallback,
        }


def get_candle_by_slug(slug: str, locale: str = "en") -> Optional[Dict[str, Any]]:
    safe_locale = _safe_locale(locale)
    clean_slug = (slug or "").strip().lower()

    if not clean_slug:
        return None

    candle = _base_candle_queryset().filter(slug__iexact=clean_slug).first()

    if not candle:
        slug_as_name = clean_slug.replace("-", " ")
        candle = (
            _base_candle_queryset()
            .filter(Q(name__iexact=slug_as_name) | Q(name__icontains=slug_as_name))
            .first()
        )

    if not candle:
        return None

    return _serialize_candle(
        candle,
        locale=safe_locale,
        match_reason=_t(
            safe_locale,
            "Exact product match.",
            "Точное совпадение товара.",
            "Coincidencia exacta del producto.",
            "Correspondance exacte du produit.",
        ),
    )


def search_candles(
    query: str,
    limit: int = 6,
    locale: str = "en",
) -> List[Dict[str, Any]]:
    raw_query = (query or "").strip()
    safe_locale = _safe_locale(locale)

    if not raw_query:
        return []

    normalized = _normalize_text(raw_query)
    terms = [part for part in re.split(r"[\s\-_\/]+", normalized) if len(part) >= 2]

    if not terms:
        return []

    search_filter = Q()

    for term in terms:
        search_filter |= (
            Q(name__icontains=term)
            | Q(name_en__icontains=term)
            | Q(name_ru__icontains=term)
            | Q(name_es__icontains=term)
            | Q(name_fr__icontains=term)
            | Q(slug__icontains=term)
            | Q(description__icontains=term)
            | Q(description_en__icontains=term)
            | Q(description_ru__icontains=term)
            | Q(description_es__icontains=term)
            | Q(description_fr__icontains=term)
            | Q(fragrance_family__icontains=term)
            | Q(intensity__icontains=term)
            | Q(top_notes__icontains=term)
            | Q(heart_notes__icontains=term)
            | Q(base_notes__icontains=term)
            | Q(mood_tags__icontains=term)
            | Q(use_case_tags__icontains=term)
            | Q(ideal_spaces__icontains=term)
            | Q(season_tags__icontains=term)
        )

    candles = (
        _base_candle_queryset()
        .filter(search_filter)
        .distinct()
        .order_by("-is_bestseller", "-created_at")[:limit]
    )

    return [
        _serialize_candle(
            candle,
            locale=safe_locale,
            match_reason=_t(
                safe_locale,
                "Matched by catalog fields.",
                "Совпало по данным каталога.",
                "Coincidencia por datos del catálogo.",
                "Correspondance selon les données du catalogue.",
            ),
        )
        for candle in candles
    ]


def build_store_context(suggestions: List[Dict[str, Any]]) -> str:
    if not suggestions:
        return "CATALOG SEARCH RESULTS: No matching products were returned by the backend."

    lines = ["CATALOG SEARCH RESULTS (use these and only these to recommend):"]

    for suggestion in suggestions:
        stock = "✓ In stock" if suggestion["in_stock"] else "✗ Out of stock"
        price_text = (
            f"From ${suggestion['price']}"
            if suggestion["price"]
            else "Price unavailable"
        )

        lines.append(
            f"• {suggestion['name']} — {price_text} — {stock} — slug: {suggestion['slug']}"
        )

        if suggestion.get("match_reason"):
            lines.append(f"  Match reason: {suggestion['match_reason']}")

        if suggestion.get("description"):
            lines.append(f"  Description: {suggestion['description']}")

        if suggestion.get("fragrance_family"):
            lines.append(f"  Fragrance family: {suggestion['fragrance_family']}")

        top_notes = _join_list(suggestion.get("top_notes"))
        if top_notes:
            lines.append(f"  Top notes: {top_notes}")

        heart_notes = _join_list(suggestion.get("heart_notes"))
        if heart_notes:
            lines.append(f"  Heart notes: {heart_notes}")

        base_notes = _join_list(suggestion.get("base_notes"))
        if base_notes:
            lines.append(f"  Base notes: {base_notes}")

        mood_tags = _join_list(suggestion.get("mood_tags"))
        if mood_tags:
            lines.append(f"  Mood: {mood_tags}")

        use_case_tags = _join_list(suggestion.get("use_case_tags"))
        if use_case_tags:
            lines.append(f"  Best for: {use_case_tags}")

        ideal_spaces = _join_list(suggestion.get("ideal_spaces"))
        if ideal_spaces:
            lines.append(f"  Ideal spaces: {ideal_spaces}")

        season_tags = _join_list(suggestion.get("season_tags"))
        if season_tags:
            lines.append(f"  Seasons: {season_tags}")

        if suggestion.get("intensity"):
            lines.append(f"  Intensity: {suggestion['intensity']}")

    return "\n".join(lines)


def _build_instructions(locale: str, user_name: Optional[str]) -> str:
    name_note = (
        f"The customer's name is {user_name}. Use it naturally, not in every message."
        if user_name
        else "The customer hasn't shared their name yet."
    )

    return f"""You are Lumière — a sophisticated, warm sales consultant at a premium handmade candle boutique.
You are NOT a generic chatbot. You are an expert who genuinely loves candles and knows everything about them.

{name_note}
Customer locale: {locale}. Always reply in that language.

STORE POLICIES:
- Customers can mark an item as a gift during checkout.
- Gift wrapping is complimentary and does not add any extra charge.
- If a customer asks whether something can be a gift, tell them they can select the gift option in the cart or during checkout at no extra cost.

HOW TO RECOMMEND:
- ONLY recommend products from CATALOG SEARCH RESULTS.
- If the customer sends a catalog URL and one product is returned, explain that exact product first.
- Do not say the product is missing if it appears in CATALOG SEARCH RESULTS.
- Use product description, notes, mood tags, best-for tags, ideal spaces, fragrance family, intensity, stock, and price.
- If multiple candles fit, recommend the 1-2 strongest matches.
- If nothing fits well, say so honestly and ask one clarifying question.

STYLE:
- Warm, premium, specific, not pushy.
- Paint a picture of the scent and the moment.
- Keep replies focused: 2-5 sentences unless describing a scent profile.
- Ask maximum ONE clarifying question per reply.
- Never invent products, prices, stock status, notes, or policies.
"""


def call_openai_reply(
    *,
    locale: str,
    user_name: Optional[str],
    user_text: str,
    store_context: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> str:
    safe_locale = _safe_locale(locale)
    api_key = (getattr(settings, "OPENAI_API_KEY", "") or "").strip()
    model = (getattr(settings, "OPENAI_MODEL", "") or "gpt-4.1-mini").strip()

    if not api_key:
        return _t(
            safe_locale,
            "AI is not configured on the server yet (OPENAI_API_KEY missing).",
            "AI пока не настроен на сервере (нет OPENAI_API_KEY).",
            "La IA aún no está configurada en el servidor (falta OPENAI_API_KEY).",
            "L'IA n'est pas encore configurée sur le serveur (OPENAI_API_KEY manquant).",
        )

    instructions = _build_instructions(safe_locale, user_name)

    history_lines: List[str] = []
    if history:
        recent = history[-HISTORY_WINDOW:]
        for message in recent:
            role_label = "Customer" if message.get("role") == "user" else "Lumière"
            history_lines.append(f"{role_label}: {message.get('text', '').strip()}")

    history_block = ""
    if history_lines:
        history_block = "CONVERSATION SO FAR:\n" + "\n".join(history_lines) + "\n\n"

    full_input = (
        f"{history_block}"
        f"{store_context}\n\n"
        f"Customer: {user_text}\n\n"
        "Lumière:"
    )

    payload = {
        "model": model,
        "instructions": instructions,
        "input": full_input,
        "temperature": 0.65,
    }

    try:
        data = _call_openai_payload(payload)
        final_text = _extract_text_from_responses_api(data)

        if final_text:
            return final_text

        return _t(
            safe_locale,
            "Sorry — I couldn't generate a reply. Try rephrasing your request.",
            "Извини — я не смогла сформировать ответ. Попробуй перефразировать запрос.",
            "Lo siento — no pude generar una respuesta. Intenta reformular tu solicitud.",
            "Désolée — je n'ai pas pu générer de réponse. Essaie de reformuler ta demande.",
        )

    except requests.HTTPError as exc:
        response = exc.response
        status_code = getattr(response, "status_code", None)
        body = getattr(response, "text", "")[:1500] if response else "<no body>"
        logger.exception("OpenAI HTTP error (%s): %s", status_code, body)
        raise

    except Exception:
        logger.exception("OpenAI request failed.")
        raise