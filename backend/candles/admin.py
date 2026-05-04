from django.contrib import admin

from .models import (
    Category,
    Collection,
    Candle,
    CandleVariant,
    CandleImage,
    Offer,
    GalleryItem,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug")
    search_fields = ("name", "slug")
    ordering = ("name",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "parent", "is_group", "slug")
    search_fields = ("name", "slug", "parent__name")
    ordering = ("parent__name", "name")
    prepopulated_fields = {"slug": ("name",)}
    list_filter = ("is_group", "parent")


@admin.register(Offer)
class OfferAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "kind",
        "badge_text",
        "discount_percent",
        "discounted_price",
        "is_active",
        "priority",
    )
    list_filter = ("is_active", "kind")
    search_fields = ("title", "slug", "badge_text")
    ordering = ("priority", "title")
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ("categories", "collections", "candles")


# =========================
# INLINES
# =========================
class CandleVariantInline(admin.TabularInline):
    model = CandleVariant
    extra = 1
    fields = ("size", "price", "stock_qty", "is_active")
    ordering = ("id",)


class CandleImageInline(admin.TabularInline):
    model = CandleImage
    extra = 0
    max_num = 5
    fields = ("image", "sort_order")
    ordering = ("sort_order", "id")


# =========================
# CANDLE
# =========================
@admin.register(Candle)
class CandleAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "is_sold_out", "is_bestseller", "created_at")
    list_filter = ("category", "is_sold_out", "is_bestseller", "created_at")
    search_fields = ("name", "slug", "description")
    ordering = ("-created_at",)
    prepopulated_fields = {"slug": ("name",)}

    # ❌ УБРАЛИ in_stock — из-за него падало
    readonly_fields = ("created_at",)

    list_editable = ("is_sold_out", "is_bestseller")
    inlines = [CandleVariantInline, CandleImageInline]


# =========================
# GALLERY
# =========================
@admin.register(GalleryItem)
class GalleryItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "media_type",
        "sort_order",
        "is_active",
        "created_at",
    )
    list_filter = ("media_type", "is_active", "created_at")
    search_fields = ("title", "slug", "caption")
    ordering = ("sort_order", "-created_at", "id")
    list_editable = ("sort_order", "is_active")
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("created_at",)

    fieldsets = (
        (
            "Content",
            {
                "fields": (
                    "title",
                    "slug",
                    "caption",
                ),
            },
        ),
        (
            "Media",
            {
                "fields": (
                    "media_type",
                    "media",
                    "preview_image",
                ),
            },
        ),
        (
            "Display",
            {
                "fields": (
                    "sort_order",
                    "is_active",
                ),
            },
        ),
        (
            "Meta",
            {
                "fields": ("created_at",),
                "classes": ("collapse",),
            },
        ),
    )