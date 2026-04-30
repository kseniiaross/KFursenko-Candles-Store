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


def _t(locale: str, en: str, ru: str, es: str, fr: str) -> str:
    if locale == "ru":
        return ru
    if locale == "es":
        return es
    if locale == "fr":
        return fr
    return en


def _format_price(value: Decimal | None) -> str:
    if value is None:
        return ""
    return f"{value:.2f}"


def _get_active_variants(candle: Candle) -> List[CandleVariant]:
    prefetched = getattr(candle, "prefetched_active_variants", None)
    if prefetched is not None:
        return list(prefetched)

    return list(candle.variants.filter(is_active=True).order_by("price", "id"))


def _get_display_price(candle: Candle) -> str:
    variants = _get_active_variants(candle)

    priced_variants = [variant for variant in variants if variant.price is not None]
    if priced_variants:
        lowest_price = min(variant.price for variant in priced_variants)
        return _format_price(lowest_price)

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


def _join_list(values: List[str] | None) -> str:
    if not values:
        return ""
    return ", ".join(v.strip() for v in values if isinstance(v, str) and v.strip())


def _serialize_candle(candle: Candle) -> Dict[str, Any]:
    return {
        "id": candle.id,
        "name": candle.name,
        "slug": candle.slug,
        "price": _get_display_price(candle),
        "in_stock": _is_candle_available(candle),
        "short_description": candle.short_description or "",
        "description": candle.description or "",
        "fragrance_family": candle.fragrance_family or "",
        "intensity": candle.intensity or "",
        "top_notes": candle.top_notes or [],
        "heart_notes": candle.heart_notes or [],
        "base_notes": candle.base_notes or [],
        "mood_tags": candle.mood_tags or [],
        "use_case_tags": candle.use_case_tags or [],
        "ideal_spaces": candle.ideal_spaces or [],
        "season_tags": candle.season_tags or [],
    }


def _base_candle_queryset():
    return (
        Candle.objects.select_related("category")
        .prefetch_related(
            Prefetch(
                "variants",
                queryset=CandleVariant.objects.filter(is_active=True).order_by("price", "id"),
                to_attr="prefetched_active_variants",
            )
        )
    )


def get_candle_by_slug(slug: str) -> Optional[Dict[str, Any]]:
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

    return _serialize_candle(candle)


def search_candles(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    q = (query or "").strip()
    if not q:
        return []

    normalized_query = q.lower()
    cleaned_query = re.sub(r"https?://\S+", " ", normalized_query)
    cleaned_query = cleaned_query.replace("/catalog/item/", " ")
    cleaned_query = cleaned_query.replace("/catalog/", " ")
    cleaned_query = re.sub(r"[^a-z0-9\s\-_]+", " ", cleaned_query)

    parts = [part for part in re.split(r"[\s\-_\/]+", cleaned_query) if len(part) >= 2]
    phrase = " ".join(parts)

    search_filter = (
        Q(name__icontains=q)
        | Q(slug__icontains=q)
        | Q(short_description__icontains=q)
        | Q(description__icontains=q)
        | Q(fragrance_family__icontains=q)
        | Q(intensity__icontains=q)
    )

    if phrase:
        search_filter |= (
            Q(name__icontains=phrase)
            | Q(slug__icontains=phrase.replace(" ", "-"))
            | Q(short_description__icontains=phrase)
            | Q(description__icontains=phrase)
            | Q(fragrance_family__icontains=phrase)
            | Q(intensity__icontains=phrase)
        )

    for part in parts:
        search_filter |= (
            Q(name__icontains=part)
            | Q(slug__icontains=part)
            | Q(short_description__icontains=part)
            | Q(description__icontains=part)
            | Q(fragrance_family__icontains=part)
            | Q(intensity__icontains=part)
        )

    qs = (
        _base_candle_queryset()
        .filter(search_filter)
        .distinct()
        .order_by("-created_at")[:limit]
    )

    return [_serialize_candle(candle) for candle in qs]


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

        if suggestion.get("short_description"):
            lines.append(f"  Short description: {suggestion['short_description']}")

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

═══ STORE POLICIES YOU MUST KNOW ═══
- Customers can mark an item as a gift during checkout.
- Gift wrapping is complimentary and does not add any extra charge.
- If a customer asks whether something can be a gift, tell them they can select the gift option in the cart or during checkout at no extra cost.

═══ YOUR EXPERTISE ═══
You know deeply about:
- Scent families: floral, woody, citrus, oriental, fresh, gourmand, green
- Burn time, wax types (soy, beeswax, paraffin, coconut), wick materials
- Mood & occasion pairing (relaxation, romance, focus, energy, grief, celebration)
- Gifting (who is it for, what's their personality, what's the occasion)
- Candle care (first burn, trimming wicks, avoiding tunneling)
- Seasonal and home styling with candles

═══ HOW TO RECOMMEND ═══
- If the customer sends a catalog product URL and CATALOG SEARCH RESULTS contains exactly one product, explain that exact product first.
- Do NOT say the product is missing if it appears in CATALOG SEARCH RESULTS.
- Do NOT ask a clarifying question before describing the exact linked product.
- Use the provided product data, including description, notes, mood, best-for tags, ideal spaces, and fragrance family.
- If the customer asks for something like "calming", "fresh", "spa-like", "not sweet", or "for a bathroom", use the structured product fields to match the best item.
- If multiple candles fit, recommend the 1-2 strongest matches.
- If nothing fits well, say so honestly and ask one clarifying question.

═══ YOUR SALES APPROACH ═══
1. If the customer asks about a specific candle, describe that candle directly:
   - summarize the scent profile
   - explain the mood / room / occasion it fits
   - mention stock status and price if provided

2. DIAGNOSE only when the customer asks for a recommendation without naming or linking a specific candle. Ask 1 targeted question to understand:
   - The occasion
   - Scent preference
   - Context

3. PAINT A PICTURE when recommending. Don't just say "this candle is nice."
   Say: "This one opens with bergamot, then settles into warm sandalwood — perfect for winding down after a long day."

4. GUIDE NATURALLY toward purchase:
   - Mention stock status when relevant
   - Suggest complementary products when appropriate
   - If something is out of stock, pivot to the best available alternative

5. REMEMBER the conversation. Build on what the customer already told you.
   Don't ask again what you've already learned.

6. HANDLE objections warmly:
   - "Too expensive" → focus on burn hours / cost per hour, gifting value
   - "Not sure" → ask one more question to narrow it down
   - "Just browsing" → invite them to share what mood they're in

═══ HARD RULES ═══
- ONLY recommend products from the CATALOG SEARCH RESULTS below
- Never invent products, prices, stock status, notes, or store policies
- Keep replies focused: 2-5 sentences unless describing a scent profile
- Ask maximum ONE clarifying question per reply
- If catalog has no match, say so honestly and ask a question to find a better match
- Never be pushy. Be the consultant customers wish every store had.
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
            if item.get("type") == "message":
                content = item.get("content", [])
                if isinstance(content, list):
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
    api_key = (getattr(settings, "OPENAI_API_KEY", "") or "").strip()
    model = (getattr(settings, "OPENAI_MODEL", "") or "gpt-4.1-mini").strip()
    timeout_s = int(getattr(settings, "OPENAI_TIMEOUT_SECONDS", 25))

    if not api_key:
        return _t(
            locale,
            "AI is not configured on the server yet (OPENAI_API_KEY missing).",
            "AI пока не настроен на сервере (нет OPENAI_API_KEY).",
            "La IA aún no está configurada en el servidor (falta OPENAI_API_KEY).",
            "L'IA n'est pas encore configurée sur le serveur (OPENAI_API_KEY manquant).",
        )

    instructions = _build_instructions(locale, user_name)

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
        "temperature": 0.75,
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

        if not final_text:
            final_text = _t(
                locale,
                "Sorry — I couldn't generate a reply. Try rephrasing your request.",
                "Извини — я не смогла сформировать ответ. Попробуй перефразировать запрос.",
                "Lo siento — no pude generar una respuesta. Intenta reformular tu solicitud.",
                "Désolée — je n'ai pas pu générer de réponse. Essaie de reformuler ta demande.",
            )

        return final_text

    except requests.HTTPError:
        status_code = getattr(response, "status_code", None)
        body = ""
        try:
            body = response.text[:1500]
        except Exception:
            body = "<no body>"
        logger.exception("OpenAI HTTP error (%s): %s", status_code, body)
        raise

    except Exception:
        logger.exception("OpenAI request failed (unexpected).")
        raise