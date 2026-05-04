from rest_framework import serializers


class LumiereMessageSerializer(serializers.Serializer):
    """Single message in the conversation history."""

    role = serializers.ChoiceField(choices=["user", "assistant"])
    text = serializers.CharField(max_length=4000)


class LumiereReplyInSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=2000)
    locale = serializers.ChoiceField(choices=["en", "ru", "es", "fr"], default="en")
    userName = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    page = serializers.CharField(required=False, allow_blank=True, default="")
    history = LumiereMessageSerializer(many=True, required=False, default=list)


class LumiereSearchInSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=500)
    locale = serializers.ChoiceField(choices=["en", "ru", "es", "fr"], default="en")
    limit = serializers.IntegerField(required=False, min_value=1, max_value=12, default=6)


class LumiereSuggestionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.CharField()
    price = serializers.CharField(allow_blank=True)
    in_stock = serializers.BooleanField()
    description = serializers.CharField(required=False, allow_blank=True)
    fragrance_family = serializers.CharField(required=False, allow_blank=True)
    intensity = serializers.CharField(required=False, allow_blank=True)
    match_reason = serializers.CharField(required=False, allow_blank=True)


class LumiereReplyOutSerializer(serializers.Serializer):
    text = serializers.CharField()
    suggestions = LumiereSuggestionSerializer(many=True, required=False)


class LumiereSearchOutSerializer(serializers.Serializer):
    query = serializers.CharField()
    suggestions = LumiereSuggestionSerializer(many=True)