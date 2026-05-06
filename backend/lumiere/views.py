import logging
import re

from rest_framework import permissions, status, throttling
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    LumiereReplyInSerializer,
    LumiereReplyOutSerializer,
    LumiereSearchInSerializer,
    LumiereSearchOutSerializer,
)
from .services import (
    ai_search_candles,
    build_store_context,
    call_openai_reply,
    get_candle_by_slug,
    search_candles,
)

logger = logging.getLogger(__name__)

_CATALOG_URL_RE = re.compile(
    r"(?:https?://(?:www\.)?kfcandle\.com)?/catalog/(?:item/)?([a-z0-9]+(?:-[a-z0-9]+)*)",
    re.IGNORECASE,
)


def extract_slug_from_text(text: str) -> str | None:
    if not text:
        return None

    match = _CATALOG_URL_RE.search(text.strip())
    if not match:
        return None

    return match.group(1).strip().lower()


class LumiereAnonThrottle(throttling.AnonRateThrottle):
    scope = "lumiere_anon"


class LumiereUserThrottle(throttling.UserRateThrottle):
    scope = "lumiere_user"


class LumiereSearchThrottle(throttling.AnonRateThrottle):
    scope = "lumiere_search"


class LumiereReplyView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LumiereAnonThrottle, LumiereUserThrottle]

    def post(self, request):
        serializer = LumiereReplyInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        text = data["text"]
        locale = data.get("locale", "en")
        user_name = (data.get("userName") or "").strip() or None
        history = data.get("history", [])

        slug = extract_slug_from_text(text)

        if slug:
            candle = get_candle_by_slug(slug, locale=locale)
            suggestions = (
                [candle]
                if candle
                else search_candles(
                    slug.replace("-", " "),
                    limit=6,
                    locale=locale,
                )
            )
        else:
            suggestions = search_candles(text, limit=6, locale=locale)

        store_context = build_store_context(suggestions)

        try:
            answer_text = call_openai_reply(
                locale=locale,
                user_name=user_name,
                user_text=text,
                store_context=store_context,
                history=history,
            )
        except Exception:
            logger.exception("Lumiere reply failed")

            answer_text = (
                "Sorry, something went wrong. Please try again."
                if locale == "en"
                else "Извини, что-то пошло не так. Попробуй ещё раз."
                if locale == "ru"
                else "Lo siento, algo salió mal. Por favor, inténtalo de nuevo."
                if locale == "es"
                else "Désolée, quelque chose s'est mal passé. Veuillez réessayer."
            )

        output = {"text": answer_text}

        if suggestions:
            output["suggestions"] = suggestions

        output_serializer = LumiereReplyOutSerializer(data=output)
        output_serializer.is_valid(raise_exception=True)

        return Response(output_serializer.data, status=status.HTTP_200_OK)


class LumiereSearchView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LumiereSearchThrottle]

    def post(self, request):
        serializer = LumiereSearchInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        query = data["query"]
        locale = data.get("locale", "en")
        limit = data.get("limit", 6)

        result = ai_search_candles(
            query=query,
            limit=limit,
            locale=locale,
        )

        output_serializer = LumiereSearchOutSerializer(data=result)
        output_serializer.is_valid(raise_exception=True)

        return Response(output_serializer.data, status=status.HTTP_200_OK)