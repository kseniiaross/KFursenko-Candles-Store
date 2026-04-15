from decimal import Decimal

from rest_framework import serializers
from orders.models import Order

from .models import (
    Category,
    Collection,
    Candle,
    CandleVariant,
    CandleImage,
    Offer,
    AboutGalleryItem,
    AboutReviewItem,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]


class CollectionSerializer(serializers.ModelSerializer):
    parent = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = ["id", "name", "slug", "is_group", "parent", "children"]

    def get_parent(self, obj: Collection):
        if not obj.parent_id:
            return None
        return {
            "id": obj.parent_id,
            "name": obj.parent.name,
            "slug": obj.parent.slug,
        }

    def get_children(self, obj: Collection):
        qs = obj.children.all().order_by("name")
        return [{"id": c.id, "name": c.name, "slug": c.slug} for c in qs]


class CandleImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = CandleImage
        fields = ["id", "image", "sort_order"]

    def get_image(self, obj):
        if not obj.image:
            return None
        try:
            return obj.image.build_url(secure=True)
        except Exception:
            return str(obj.image)


class CandleVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = CandleVariant
        fields = ["id", "size", "price", "stock_qty", "is_active"]


class CandleBadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Offer
        fields = ["slug", "badge_text", "kind", "discount_percent", "priority"]


class CandleSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    images = CandleImageSerializer(many=True, read_only=True)
    variants = CandleVariantSerializer(many=True, read_only=True)

    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source="category",
        write_only=True,
    )

    collections = CollectionSerializer(many=True, read_only=True)
    collection_ids = serializers.PrimaryKeyRelatedField(
        queryset=Collection.objects.all(),
        source="collections",
        many=True,
        write_only=True,
        required=False,
    )

    badges = serializers.SerializerMethodField()
    discount_price = serializers.SerializerMethodField()

    class Meta:
        model = Candle
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "price",
            "discount_price",
            "stock_qty",
            "in_stock",
            "is_sold_out",
            "is_bestseller",
            "created_at",
            "image",
            "images",
            "variants",
            "category",
            "category_id",
            "collections",
            "collection_ids",
            "badges",
        ]
        read_only_fields = [
            "slug",
            "in_stock",
            "created_at",
            "category",
            "collections",
            "images",
            "variants",
            "badges",
            "image",
            "discount_price",
        ]

    def get_image(self, obj):
        if not obj.image:
            return None
        try:
            return obj.image.build_url(secure=True)
        except Exception:
            return str(obj.image)

    def get_badges(self, obj: Candle):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        is_authed = bool(user and user.is_authenticated)
        is_new_shopper = False

        if is_authed:
            is_new_shopper = not Order.objects.filter(user=user).exists()

        qs = Offer.objects.filter(is_active=True)

        global_offers = qs.filter(apply_globally=True)
        direct_m2m = obj.offers.filter(is_active=True)
        direct_reverse = qs.filter(candles=obj)
        by_category = qs.filter(categories=obj.category)
        by_collections = qs.filter(collections__in=obj.collections.all())

        combined = (
            global_offers
            | direct_m2m
            | direct_reverse
            | by_category
            | by_collections
        ).distinct()

        if not is_new_shopper:
            combined = combined.exclude(new_shopper_only=True)

        combined = combined.order_by("priority", "title")

        return CandleBadgeSerializer(combined, many=True).data

    def get_discount_price(self, obj: Candle):
        if obj.price is None:
            return None

        request = self.context.get("request")
        user = getattr(request, "user", None)

        base_price = Decimal(obj.price)

        qs = Offer.objects.filter(is_active=True)

        global_offers = qs.filter(apply_globally=True)
        direct_m2m = obj.offers.filter(is_active=True)
        direct_reverse = qs.filter(candles=obj)
        by_category = qs.filter(categories=obj.category)
        by_collections = qs.filter(collections__in=obj.collections.all())

        combined = (
            global_offers
            | direct_m2m
            | direct_reverse
            | by_category
            | by_collections
        ).distinct()

        for offer in combined:
            if offer.new_shopper_only:
                if not user or not user.is_authenticated:
                    continue
                if Order.objects.filter(user=user).exists():
                    continue

            if offer.discount_percent:
                discount = base_price * Decimal(offer.discount_percent) / Decimal(100)
                return round(base_price - discount, 2)

            if offer.discounted_price:
                return offer.discounted_price

        return None

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than 0.")
        return value

    def validate_stock_qty(self, value):
        if value < 0:
            raise serializers.ValidationError("stock_qty cannot be negative.")
        return value


class AboutGalleryItemSerializer(serializers.ModelSerializer):
    media = serializers.SerializerMethodField()
    preview_image = serializers.SerializerMethodField()

    class Meta:
        model = AboutGalleryItem
        fields = [
            "id",
            "title",
            "slug",
            "media_type",
            "media",
            "preview_image",
            "caption",
            "sort_order",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["slug", "created_at"]

    def get_media(self, obj):
        if not obj.media:
            return None
        try:
            return obj.media.build_url(secure=True)
        except Exception:
            return str(obj.media)

    def get_preview_image(self, obj):
        if not obj.preview_image:
            return None
        try:
            return obj.preview_image.build_url(secure=True)
        except Exception:
            return str(obj.preview_image)


class AboutReviewItemSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = AboutReviewItem
        fields = [
            "id",
            "title",
            "customer_name",
            "image",
            "caption",
            "sort_order",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_image(self, obj):
        if not obj.image:
            return None
        try:
            return obj.image.build_url(secure=True)
        except Exception:
            return str(obj.image)