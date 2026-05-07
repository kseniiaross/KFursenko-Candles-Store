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
    list_display = (
        "id",
        "name",
        "fragrance_family",
        "intensity",
        "variant_stock_total",
        "has_active_stock",
        "is_sold_out",
        "is_bestseller",
        "created_at",
    )
    list_filter = (
        "category",
        "fragrance_family",
        "intensity",
        "is_sold_out",
        "is_bestseller",
        "created_at",
    )
    search_fields = (
        "name",
        "slug",
        "description",
        "fragrance_family",
        "mood_tags",
        "use_case_tags",
        "ideal_spaces",
        "season_tags",
    )
    ordering = ("-created_at",)
    prepopulated_fields = {"slug": ("name",)}

    readonly_fields = ("created_at", "variant_stock_total", "has_active_stock")
    list_editable = ("is_sold_out", "is_bestseller")
    filter_horizontal = ("collections", "offers")
    inlines = [CandleVariantInline, CandleImageInline]

    fieldsets = (
        (
            "Main",
            {
                "fields": (
                    "category",
                    "collections",
                    "offers",
                    "name",
                    "slug",
                    "description",
                    "image",
                    "price",
                ),
            },
        ),
        (
            "AI Search / Scent Profile",
            {
                "fields": (
                    "fragrance_family",
                    "intensity",
                    "top_notes",
                    "heart_notes",
                    "base_notes",
                    "mood_tags",
                    "use_case_tags",
                    "ideal_spaces",
                    "season_tags",
                ),
                "description": (
                    "Use JSON arrays for notes/tags. Example: "
                    '["cozy", "warm", "bedroom", "relaxing"]'
                ),
            },
        ),
        (
            "Display",
            {
                "fields": (
                    "is_sold_out",
                    "is_bestseller",
                ),
            },
        ),
        (
            "Variant stock summary",
            {
                "fields": (
                    "variant_stock_total",
                    "has_active_stock",
                ),
                "classes": ("collapse",),
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

    def variant_stock_total(self, obj):
        return sum(
            variant.stock_qty
            for variant in obj.variants.all()
            if variant.is_active
        )

    variant_stock_total.short_description = "Variant stock total"

    def has_active_stock(self, obj):
        return obj.variants.filter(is_active=True, stock_qty__gt=0).exists()

    has_active_stock.boolean = True
    has_active_stock.short_description = "Has active variant stock"


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