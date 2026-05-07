from rest_framework import serializers


class LumiereMessageSerializer(serializers.Serializer):
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
    explain = serializers.BooleanField(required=False, default=False)


class LumiereSuggestionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.CharField()
    price = serializers.CharField(allow_blank=True)
    in_stock = serializers.BooleanField()
    description = serializers.CharField(required=False, allow_blank=True)
    fragrance_family = serializers.CharField(required=False, allow_blank=True)
    intensity = serializers.CharField(required=False, allow_blank=True)
    top_notes = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    heart_notes = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    base_notes = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    mood_tags = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    use_case_tags = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    ideal_spaces = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    season_tags = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    match_reason = serializers.CharField(required=False, allow_blank=True)


class LumiereReplyOutSerializer(serializers.Serializer):
    text = serializers.CharField()
    suggestions = LumiereSuggestionSerializer(many=True, required=False)


class LumiereSearchOutSerializer(serializers.Serializer):
    query = serializers.CharField()
    text = serializers.CharField(required=False, allow_blank=True)
    suggestions = LumiereSuggestionSerializer(many=True)