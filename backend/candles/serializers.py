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


SUPPORTED_LOCALES = {"en", "ru", "es", "fr"}


# ======================================================
# IMAGE OPTIMIZATION (Cloudinary)
# ======================================================
def build_cloudinary_image_url(image, width=900, height=600):
    if not image:
        return None

    try:
        return image.build_url(
            secure=True,
            fetch_format="auto",
            quality="auto",
            width=width,
            height=height,
            crop="fill",
            gravity="auto",
        )
    except Exception:
        return str(image)


# ======================================================
# LOCALE HELPERS
# ======================================================
def get_locale_from_request(request):
    if not request:
        return "en"

    query_locale = (request.query_params.get("lang") or "").lower().strip()
    if query_locale in SUPPORTED_LOCALES:
        return query_locale

    header = (request.headers.get("Accept-Language") or "").lower().strip()
    for locale in SUPPORTED_LOCALES:
        if header.startswith(locale):
            return locale

    return "en"


def localized_value(obj, field_name, locale):
    translated = getattr(obj, f"{field_name}_{locale}", "") or ""
    fallback = getattr(obj, field_name, "") or ""
    return translated.strip() or fallback


# ======================================================
# BASIC SERIALIZERS
# ======================================================
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

    def get_parent(self, obj):
        if not obj.parent_id:
            return None

        return {
            "id": obj.parent_id,
            "name": obj.parent.name,
            "slug": obj.parent.slug,
        }

    def get_children(self, obj):
        qs = obj.children.all().order_by("name")
        return [{"id": c.id, "name": c.name, "slug": c.slug} for c in qs]


# ======================================================
# CANDLE MEDIA
# ======================================================
class CandleImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = CandleImage
        fields = ["id", "image", "sort_order"]

    def get_image(self, obj):
        return build_cloudinary_image_url(obj.image, width=1200, height=900)


class CandleVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = CandleVariant
        fields = ["id", "size", "price", "stock_qty", "is_active"]


class CandleBadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Offer
        fields = ["slug", "badge_text", "kind", "discount_percent", "priority"]


# ======================================================
# MAIN CANDLE SERIALIZER
# ======================================================
class CandleSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()

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
            "name_en",
            "name_ru",
            "name_es",
            "name_fr",
            "slug",
            "description",
            "description_en",
            "description_ru",
            "description_es",
            "description_fr",
            "fragrance_family",
            "intensity",
            "top_notes",
            "heart_notes",
            "base_notes",
            "mood_tags",
            "use_case_tags",
            "ideal_spaces",
            "season_tags",
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

    def get_name(self, obj):
        locale = get_locale_from_request(self.context.get("request"))
        return localized_value(obj, "name", locale)

    def get_description(self, obj):
        locale = get_locale_from_request(self.context.get("request"))
        return localized_value(obj, "description", locale)

    def get_image(self, obj):
        return build_cloudinary_image_url(obj.image, width=900, height=600)

    def get_badges(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        is_new_shopper = (
            user and user.is_authenticated and not Order.objects.filter(user=user).exists()
        )

        qs = Offer.objects.filter(is_active=True)

        combined = (
            qs.filter(apply_globally=True)
            | obj.offers.filter(is_active=True)
            | qs.filter(candles=obj)
            | qs.filter(categories=obj.category)
            | qs.filter(collections__in=obj.collections.all())
        ).distinct()

        if not is_new_shopper:
            combined = combined.exclude(new_shopper_only=True)

        return CandleBadgeSerializer(
            combined.order_by("priority", "title"), many=True
        ).data

    def get_discount_price(self, obj):
        if obj.price is None:
            return None

        request = self.context.get("request")
        user = getattr(request, "user", None)

        base_price = Decimal(obj.price)

        qs = Offer.objects.filter(is_active=True)

        combined = (
            qs.filter(apply_globally=True)
            | obj.offers.filter(is_active=True)
            | qs.filter(candles=obj)
            | qs.filter(categories=obj.category)
            | qs.filter(collections__in=obj.collections.all())
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


# ======================================================
# ABOUT / GALLERY
# ======================================================
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
        return build_cloudinary_image_url(obj.media, width=1200, height=800)

    def get_preview_image(self, obj):
        return build_cloudinary_image_url(obj.preview_image, width=1200, height=800)


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
        return build_cloudinary_image_url(obj.image, width=800, height=800)