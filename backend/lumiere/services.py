import hashlib
import json
import logging
import re
from decimal import Decimal
from typing import Any, Dict, List, Optional

import requests
from django.conf import settings
from django.core.cache import cache
from django.db.models import Prefetch, Q

from candles.models import Candle, CandleVariant

logger = logging.getLogger(__name__)

HISTORY_WINDOW = 10
AI_SEARCH_CATALOG_LIMIT = 80
AI_SEARCH_CACHE_SECONDS = 60 * 30

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


def _safe_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []

    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _join_list(value: Any) -> str:
    return ", ".join(_safe_list(value))


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


def _cache_key(prefix: str, query: str, locale: str, limit: int) -> str:
    raw = f"{prefix}:{locale}:{limit}:{_normalize_text(query)}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"lumiere:{prefix}:{digest}"


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

    return candle.stock_qty > 0


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
        "fragrance_family": candle.fragrance_family or "",
        "intensity": candle.intensity or "",
        "top_notes": _safe_list(candle.top_notes),
        "heart_notes": _safe_list(candle.heart_notes),
        "base_notes": _safe_list(candle.base_notes),
        "mood_tags": _safe_list(candle.mood_tags),
        "use_case_tags": _safe_list(candle.use_case_tags),
        "ideal_spaces": _safe_list(candle.ideal_spaces),
        "season_tags": _safe_list(candle.season_tags),
        "match_reason": match_reason,
    }


def _compact_candle_for_ai(candle: Candle, locale: str) -> Dict[str, Any]:
    variants = _get_active_variants(candle)

    return {
        "id": candle.id,
        "name": _localized_value(candle, "name", locale),
        "slug": candle.slug,
        "description": _localized_value(candle, "description", locale)[:900],
        "category": candle.category.name if candle.category_id else "",
        "collections": [collection.name for collection in candle.collections.all()],
        "price_from": _get_display_price(candle),
        "in_stock": _is_candle_available(candle),
        "is_bestseller": candle.is_bestseller,
        "fragrance_family": candle.fragrance_family or "",
        "intensity": candle.intensity or "",
        "top_notes": _safe_list(candle.top_notes),
        "heart_notes": _safe_list(candle.heart_notes),
        "base_notes": _safe_list(candle.base_notes),
        "mood_tags": _safe_list(candle.mood_tags),
        "use_case_tags": _safe_list(candle.use_case_tags),
        "ideal_spaces": _safe_list(candle.ideal_spaces),
        "season_tags": _safe_list(candle.season_tags),
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

    cache_key = _cache_key("ai_search", clean_query, safe_locale, limit)
    cached_result = cache.get(cache_key)

    if isinstance(cached_result, dict):
        return cached_result

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

Use ONLY this catalog. Do not invent products, prices, stock status, scent notes, or policies.

The catalog includes:
- product name
- description
- category
- collections
- fragrance family
- intensity
- top notes
- heart notes
- base notes
- mood tags
- use case tags
- ideal spaces
- season tags
- variants with size, price, and stock

Understand natural-language shopping intent:
- mood: cozy, relaxing, romantic, clean, fresh, warm, elegant
- room: bedroom, bathroom, kitchen, office, living room
- purpose: gift, reading, sleep, focus, spa night, hosting
- preferences: not sweet, floral, woody, citrus, vanilla, soft, strong

Return ONLY valid JSON:
{{
  "text": "short premium explanation",
  "product_ids": [1, 2, 3],
  "reasons": {{
    "1": "short reason"
  }}
}}

Rules:
- product_ids must be real ids from catalog.
- product_ids length: 0 to {limit}.
- Prefer in-stock products.
- Prefer stronger intent matches over bestsellers.
- text should be 2-4 sentences.
- reasons should be short and specific.
- Reply in locale: {safe_locale}.
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
        explanation = str(parsed.get("text", "") or "")

        product_ids = [
            int(product_id)
            for product_id in product_ids_raw
            if str(product_id).isdigit()
        ][:limit]

        reasons = reasons_raw if isinstance(reasons_raw, dict) else {}

        candles = list(_base_candle_queryset().filter(id__in=product_ids))
        candle_map = {candle.id: candle for candle in candles}

        suggestions = []

        for product_id in product_ids:
            candle = candle_map.get(product_id)

            if not candle:
                continue

            suggestions.append(
                _serialize_candle(
                    candle,
                    locale=safe_locale,
                    match_reason=str(reasons.get(str(product_id), "") or ""),
                )
            )

        result = {
            "query": clean_query,
            "text": explanation
            or _t(
                safe_locale,
                "Here are the closest matches I found based on your request.",
                "Вот самые близкие варианты, которые я нашла по твоему запросу.",
                "Estas son las mejores coincidencias que encontré según tu búsqueda.",
                "Voici les meilleures correspondances que j'ai trouvées pour ta recherche.",
            ),
            "suggestions": suggestions,
        }

        cache.set(cache_key, result, AI_SEARCH_CACHE_SECONDS)
        return result

    except Exception:
        logger.exception("Lumiere AI Search failed. Falling back to local search.")

        fallback = search_candles(clean_query, limit=limit, locale=safe_locale)

        return {
            "query": clean_query,
            "text": _t(
                safe_locale,
                "Lumière is temporarily using catalog matching instead of full AI search. These are the closest candles I found from the available product data.",
                "Lumière временно использует поиск по каталогу вместо полного AI-поиска. Я показала самые близкие свечи по доступным данным товара.",
                "Lumière está usando temporalmente coincidencias del catálogo en lugar de la búsqueda completa con IA. Estas son las velas más cercanas según los datos disponibles.",
                "Lumière utilise temporairement la recherche catalogue au lieu de la recherche IA complète. Voici les bougies les plus proches selon les données disponibles.",
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
            | Q(slug__icontains=term)
            | Q(description__icontains=term)
            | Q(category__name__icontains=term)
            | Q(collections__name__icontains=term)
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

    lines = ["CATALOG SEARCH RESULTS:"]

    for suggestion in suggestions:
        stock = "In stock" if suggestion["in_stock"] else "Out of stock"
        price_text = (
            f"From ${suggestion['price']}"
            if suggestion["price"]
            else "Price unavailable"
        )

        lines.append(
            f"- {suggestion['name']} — {price_text} — {stock} — slug: {suggestion['slug']}"
        )

        if suggestion.get("match_reason"):
            lines.append(f"  Match reason: {suggestion['match_reason']}")

        if suggestion.get("description"):
            lines.append(f"  Description: {suggestion['description']}")

        if suggestion.get("fragrance_family"):
            lines.append(f"  Fragrance family: {suggestion['fragrance_family']}")

        if suggestion.get("intensity"):
            lines.append(f"  Intensity: {suggestion['intensity']}")

        notes = [
            ("Top notes", suggestion.get("top_notes")),
            ("Heart notes", suggestion.get("heart_notes")),
            ("Base notes", suggestion.get("base_notes")),
            ("Mood", suggestion.get("mood_tags")),
            ("Best for", suggestion.get("use_case_tags")),
            ("Ideal spaces", suggestion.get("ideal_spaces")),
            ("Season", suggestion.get("season_tags")),
        ]

        for label, values in notes:
            joined = _join_list(values)
            if joined:
                lines.append(f"  {label}: {joined}")

    return "\n".join(lines)


def _build_instructions(locale: str, user_name: Optional[str]) -> str:
    name_note = (
        f"The customer's name is {user_name}. Use it naturally, not in every message."
        if user_name
        else "The customer hasn't shared their name yet."
    )

    return f"""You are Lumière — a sophisticated, warm sales consultant at a premium handmade candle boutique.

{name_note}
Customer locale: {locale}. Always reply in that language.

Rules:
- ONLY recommend products from CATALOG SEARCH RESULTS.
- Never invent products, prices, stock status, notes, or policies.
- Use scent notes, mood tags, use case tags, ideal spaces, fragrance family, and intensity when available.
- Customers can mark an item as a gift during checkout.
- Gift wrapping is complimentary.
- Keep replies warm, premium, and specific.
- Ask maximum one clarifying question.
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
            "AI is not configured on the server yet.",
            "AI пока не настроен на сервере.",
            "La IA aún no está configurada en el servidor.",
            "L'IA n'est pas encore configurée sur le serveur.",
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

    except Exception:
        logger.exception("OpenAI request failed.")
        raise