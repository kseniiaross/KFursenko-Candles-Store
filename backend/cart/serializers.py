from rest_framework import serializers

from candles.models import CandleVariant
from .models import Cart, CartItem


def build_cloudinary_url(file_field):
    if not file_field:
        return None

    try:
        return file_field.build_url(secure=True)
    except Exception:
        return str(file_field)


class CartItemSerializer(serializers.ModelSerializer):
    variant_id = serializers.PrimaryKeyRelatedField(
        queryset=CandleVariant.objects.select_related("candle").all(),
        source="variant",
        write_only=True,
    )

    item_id = serializers.IntegerField(source="id", read_only=True)
    candle_id = serializers.IntegerField(source="variant.candle.id", read_only=True)
    name = serializers.CharField(source="variant.candle.name", read_only=True)
    slug = serializers.CharField(source="variant.candle.slug", read_only=True)
    image = serializers.SerializerMethodField(read_only=True)
    price = serializers.DecimalField(
        source="variant.price",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    size = serializers.CharField(source="variant.size", read_only=True)
    in_stock = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CartItem
        fields = (
            "item_id",
            "variant_id",
            "candle_id",
            "name",
            "slug",
            "image",
            "price",
            "size",
            "quantity",
            "in_stock",
            "is_gift",
        )
        read_only_fields = (
            "item_id",
            "candle_id",
            "name",
            "slug",
            "image",
            "price",
            "size",
            "in_stock",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["variant_id"] = instance.variant_id
        return data

    def get_image(self, obj):
        return build_cloudinary_url(obj.variant.candle.image)

    def get_in_stock(self, obj):
        return bool(obj.variant.is_active and obj.variant.stock_qty > 0)

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Quantity must be >= 1.")
        return value


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = ("id", "items", "created_at", "updated_at")
        read_only_fields = ("id", "items", "created_at", "updated_at")


class MergeCartItemInputSerializer(serializers.Serializer):
    variant_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=999)
    is_gift = serializers.BooleanField(required=False, default=False)

    def validate_variant_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("variant_id must be positive.")
        return value


class MergeCartSerializer(serializers.Serializer):
    items = MergeCartItemInputSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("items must not be empty.")
        return items