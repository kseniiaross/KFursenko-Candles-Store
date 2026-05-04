import logging
import re
from decimal import Decimal
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional

import requests
from django.conf import settings
from django.db.models import Prefetch, Q

from candles.models import Candle, CandleVariant

logger = logging.getLogger(__name__)

HISTORY_WINDOW = 10

SUPPORTED_LOCALES = {"en", "ru", "es", "fr"}

PRODUCT_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?kfcandle\.com/catalog/(?:item/)?(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)",
    re.IGNORECASE,
)

NOISE_PHRASES_RE = re.compile(
    r"\b("
    r"tell me about|what about|show me|find me|find|search for|search|"
    r"do you have|have you got|i want|i need|i am looking for|i'm looking for|"
    r"can you tell me about|can you show me|please|pls|about|candle|candles|"
    r"this|that|item|product|the|a|an|for|with|to|me|my|need|want|looking"
    r")\b",
    re.IGNORECASE,
)

INTENT_EXPANSIONS: Dict[str, Dict[str, List[str]]] = {
    "en": {
        "calming": ["calm", "relax", "relaxing", "soothing", "soft", "peaceful", "spa", "bedtime", "sleep"],
        "bedroom": ["bedroom", "sleep", "night", "evening", "cozy", "relax"],
        "fresh": ["fresh", "clean", "citrus", "green", "spa", "airy"],
        "cozy": ["cozy", "warm", "comfort", "evening", "home"],
        "gift": ["gift", "present", "birthday", "holiday", "romantic"],
        "focus": ["focus", "work", "study", "desk", "clean"],
        "not sweet": ["not sweet", "unsweet", "clean", "fresh", "woody", "herbal"],
        "sweet": ["sweet", "gourmand", "vanilla", "dessert", "warm"],
    },
    "ru": {
        "успокаивающая": ["спокойный", "спокойная", "расслабляющий", "расслабляющая", "мягкий", "мягкая", "спа", "сон"],
        "спальня": ["спальня", "сон", "ночь", "вечер", "уют", "расслабление"],
        "свежий": ["свежий", "свежая", "чистый", "чистая", "цитрус", "зелёный", "зеленый", "спа"],
        "уютный": ["уют", "уютный", "тёплый", "теплый", "вечер", "дом"],
        "подарок": ["подарок", "день рождения", "праздник", "романтика"],
        "фокус": ["фокус", "работа", "учёба", "учеба", "стол", "чистый"],
        "не сладкий": ["не сладкий", "не сладкая", "несладкий", "несладкая", "свежий", "древесный", "травяной"],
        "сладкий": ["сладкий", "сладкая", "ваниль", "десерт", "тёплый", "теплый"],
    },
    "es": {
        "relajante": ["calma", "relajante", "suave", "tranquilo", "spa", "dormir", "noche"],
        "dormitorio": ["dormitorio", "sueño", "noche", "tarde", "acogedor"],
        "fresco": ["fresco", "limpio", "cítrico", "verde", "spa", "aireado"],
        "acogedor": ["acogedor", "cálido", "hogar", "tarde", "confort"],
        "regalo": ["regalo", "cumpleaños", "fiesta", "romántico"],
        "concentración": ["concentración", "trabajo", "estudio", "escritorio", "limpio"],
        "no dulce": ["no dulce", "fresco", "limpio", "amaderado", "herbal"],
        "dulce": ["dulce", "gourmand", "vainilla", "postre", "cálido"],
    },
    "fr": {
        "apaisant": ["calme", "apaisant", "doux", "relaxant", "spa", "sommeil", "soir"],
        "chambre": ["chambre", "sommeil", "nuit", "soir", "douillet"],
        "frais": ["frais", "propre", "agrume", "vert", "spa", "aéré"],
        "douillet": ["douillet", "chaleureux", "maison", "soir", "confort"],
        "cadeau": ["cadeau", "anniversaire", "fête", "romantique"],
        "concentration": ["concentration", "travail", "étude", "bureau", "propre"],
        "pas sucré": ["pas sucré", "frais", "propre", "boisé", "herbal"],
        "sucré": ["sucré", "gourmand", "vanille", "dessert", "chaleureux"],
    },
}

NEGATIVE_EXPANSIONS: Dict[str, Dict[str, List[str]]] = {
    "en": {
        "not sweet": ["sweet", "sugary", "dessert", "gourmand", "vanilla", "caramel"],
        "not strong": ["strong", "intense", "heavy", "bold"],
        "not floral": ["floral", "flower", "rose", "jasmine"],
    },
    "ru": {
        "не сладкий": ["сладкий", "сладкая", "сахарный", "десерт", "ваниль", "карамель"],
        "не сильный": ["сильный", "интенсивный", "тяжёлый", "тяжелый", "яркий"],
        "не цветочный": ["цветочный", "цветы", "роза", "жасмин"],
    },
    "es": {
        "no dulce": ["dulce", "azucarado", "postre", "gourmand", "vainilla", "caramelo"],
        "no fuerte": ["fuerte", "intenso", "pesado"],
        "no floral": ["floral", "flores", "rosa", "jazmín"],
    },
    "fr": {
        "pas sucré": ["sucré", "dessert", "gourmand", "vanille", "caramel"],
        "pas fort": ["fort", "intense", "lourd"],
        "pas floral": ["floral", "fleur", "rose", "jasmin"],
    },
}


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
    text = NOISE_PHRASES_RE.sub(" ", text)
    text = re.sub(r"[^a-zа-яёáéíóúüñçàâêîôûëïü0-9\s\-_]+", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _split_terms(value: str) -> List[str]:
    normalized = _normalize_text(value)
    return [part for part in re.split(r"[\s\-_\/]+", normalized) if len(part) >= 2]


def _expanded_terms(query: str, locale: str) -> List[str]:
    safe_locale = _safe_locale(locale)
    normalized_query = _normalize_text(query)
    terms = set(_split_terms(query))

    expansions = INTENT_EXPANSIONS.get(safe_locale, {})
    for intent, related_terms in expansions.items():
        normalized_intent = _normalize_text(intent)
        if normalized_intent and normalized_intent in normalized_query:
            terms.update(_normalize_text(term) for term in related_terms if term)

    return [term for term in terms if term]


def _negative_terms(query: str, locale: str) -> List[str]:
    safe_locale = _safe_locale(locale)
    normalized_query = _normalize_text(query)
    negatives = set()

    expansions = NEGATIVE_EXPANSIONS.get(safe_locale, {})
    for intent, related_terms in expansions.items():
        normalized_intent = _normalize_text(intent)
        if normalized_intent and normalized_intent in normalized_query:
            negatives.update(_normalize_text(term) for term in related_terms if term)

    return [term for term in negatives if term]


def _similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, left.lower(), right.lower()).ratio()


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

    if candle.stock_qty > 0:
        return True

    return bool(candle.in_stock)


def _base_candle_queryset():
    return (
        Candle.objects.select_related("category")
        .prefetch_related(
            "collections",
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


def _extract_slug_candidates(query: str) -> List[str]:
    raw = (query or "").strip()
    candidates: List[str] = []

    for match in PRODUCT_URL_RE.finditer(raw):
        slug = match.group("slug").strip().lower()
        if slug:
            candidates.append(slug)

    generic_matches = re.findall(
        r"/catalog/(?:item/)?([a-z0-9]+(?:-[a-z0-9]+)*)",
        raw,
        flags=re.IGNORECASE,
    )

    for slug in generic_matches:
        clean_slug = slug.strip().lower()
        if clean_slug:
            candidates.append(clean_slug)

    normalized = _normalize_text(raw)
    if normalized:
        candidates.append(normalized.replace(" ", "-"))

    unique: List[str] = []
    for item in candidates:
        if item and item not in unique:
            unique.append(item)

    return unique


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
        "top_notes": candle.top_notes or [],
        "heart_notes": candle.heart_notes or [],
        "base_notes": candle.base_notes or [],
        "mood_tags": candle.mood_tags or [],
        "use_case_tags": candle.use_case_tags or [],
        "ideal_spaces": candle.ideal_spaces or [],
        "season_tags": candle.season_tags or [],
        "match_reason": match_reason,
    }


def _build_search_blob(candle: Candle, locale: str) -> str:
    values = [
        candle.name,
        candle.name_en,
        candle.name_ru,
        candle.name_es,
        candle.name_fr,
        candle.slug,
        candle.description,
        candle.description_en,
        candle.description_ru,
        candle.description_es,
        candle.description_fr,
        candle.fragrance_family,
        candle.intensity,
        candle.category.name if candle.category_id else "",
        _join_list(candle.top_notes),
        _join_list(candle.heart_notes),
        _join_list(candle.base_notes),
        _join_list(candle.mood_tags),
        _join_list(candle.use_case_tags),
        _join_list(candle.ideal_spaces),
        _join_list(candle.season_tags),
        _localized_value(candle, "name", locale),
        _localized_value(candle, "description", locale),
    ]

    return _normalize_text(" ".join(value for value in values if value))


def _build_match_reason(candle: Candle, query: str, locale: str) -> str:
    terms = _expanded_terms(query, locale)

    matched_parts: List[str] = []

    fields = {
        "fragrance family": candle.fragrance_family,
        "intensity": candle.intensity,
        "top notes": _join_list(candle.top_notes),
        "heart notes": _join_list(candle.heart_notes),
        "base notes": _join_list(candle.base_notes),
        "mood": _join_list(candle.mood_tags),
        "best for": _join_list(candle.use_case_tags),
        "ideal spaces": _join_list(candle.ideal_spaces),
        "season": _join_list(candle.season_tags),
    }

    for label, value in fields.items():
        normalized_value = _normalize_text(value)
        if normalized_value and any(term in normalized_value for term in terms):
            matched_parts.append(label)

    if matched_parts:
        joined = ", ".join(matched_parts[:3])
        return _t(
            locale,
            f"Matched by {joined}.",
            f"Совпало по: {joined}.",
            f"Coincide por {joined}.",
            f"Correspondance par {joined}.",
        )

    if candle.fragrance_family:
        return _t(
            locale,
            f"Similar scent profile: {candle.fragrance_family}.",
            f"Похожий ароматический профиль: {candle.fragrance_family}.",
            f"Perfil aromático similar: {candle.fragrance_family}.",
            f"Profil olfactif similaire : {candle.fragrance_family}.",
        )

    return _t(
        locale,
        "Relevant match based on product description.",
        "Подходит по описанию товара.",
        "Coincidencia relevante según la descripción del producto.",
        "Correspondance pertinente selon la description du produit.",
    )


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

    slug_candidates = _extract_slug_candidates(raw_query)

    for slug in slug_candidates:
        candle = get_candle_by_slug(slug, locale=safe_locale)
        if candle:
            return [candle]

    cleaned_query = _normalize_text(raw_query)
    terms = _expanded_terms(raw_query, safe_locale)
    negatives = _negative_terms(raw_query, safe_locale)

    if not cleaned_query and not terms:
        return []

    phrase_slug = cleaned_query.replace(" ", "-")

    search_filter = (
        Q(name__icontains=cleaned_query)
        | Q(name_en__icontains=cleaned_query)
        | Q(name_ru__icontains=cleaned_query)
        | Q(name_es__icontains=cleaned_query)
        | Q(name_fr__icontains=cleaned_query)
        | Q(slug__icontains=cleaned_query)
        | Q(slug__icontains=phrase_slug)
        | Q(description__icontains=cleaned_query)
        | Q(description_en__icontains=cleaned_query)
        | Q(description_ru__icontains=cleaned_query)
        | Q(description_es__icontains=cleaned_query)
        | Q(description_fr__icontains=cleaned_query)
        | Q(fragrance_family__icontains=cleaned_query)
        | Q(intensity__icontains=cleaned_query)
        | Q(top_notes__icontains=cleaned_query)
        | Q(heart_notes__icontains=cleaned_query)
        | Q(base_notes__icontains=cleaned_query)
        | Q(mood_tags__icontains=cleaned_query)
        | Q(use_case_tags__icontains=cleaned_query)
        | Q(ideal_spaces__icontains=cleaned_query)
        | Q(season_tags__icontains=cleaned_query)
    )

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

    candidates = list(_base_candle_queryset().filter(search_filter).distinct())

    if not candidates:
        candidates = list(_base_candle_queryset().all())

    scored: List[tuple[float, Candle]] = []

    for candle in candidates:
        blob = _build_search_blob(candle, safe_locale)
        name = _normalize_text(_localized_value(candle, "name", safe_locale))
        slug = _normalize_text((candle.slug or "").replace("-", " "))

        score = 0.0

        if cleaned_query and cleaned_query in blob:
            score += 8.0

        if cleaned_query and cleaned_query in name:
            score += 10.0

        if cleaned_query and cleaned_query in slug:
            score += 9.0

        for term in terms:
            if term in name:
                score += 4.0
            if term in slug:
                score += 3.5
            if term in blob:
                score += 2.0

        for negative in negatives:
            if negative in blob:
                score -= 4.0

        if cleaned_query:
            score += max(
                _similarity(cleaned_query, name),
                _similarity(cleaned_query, slug),
            ) * 3.0

        if score > 0:
            scored.append((score, candle))

    scored.sort(key=lambda item: item[0], reverse=True)

    return [
        _serialize_candle(
            candle,
            locale=safe_locale,
            match_reason=_build_match_reason(candle, raw_query, safe_locale),
        )
        for _, candle in scored[:limit]
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
- If the customer asks for something like calming, fresh, spa-like, not sweet, bathroom, bedroom, gift, focus, romance, or cozy, match against the structured product fields.
- If multiple candles fit, recommend the 1-2 strongest matches.
- If nothing fits well, say so honestly and ask one clarifying question.

STYLE:
- Warm, premium, specific, not pushy.
- Paint a picture of the scent and the moment.
- Keep replies focused: 2-5 sentences unless describing a scent profile.
- Ask maximum ONE clarifying question per reply.
- Never invent products, prices, stock status, notes, or policies.
"""


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
    timeout_s = int(getattr(settings, "OPENAI_TIMEOUT_SECONDS", 25))

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

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            "https://api.openai.com/v1/responses",
            headers=headers,
            json=payload,
            timeout=timeout_s,
        )
        response.raise_for_status()

        data = response.json()
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