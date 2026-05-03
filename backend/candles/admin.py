from django.contrib import admin
from django import forms

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
        "new_shopper_only",
        "new_shopper_days_active",
        "apply_globally",
        "offer_start",
        "offer_end",
        "priority",
    )
    list_filter = (
        "is_active",
        "kind",
        "new_shopper_only",
        "apply_globally",
        "offer_start",
        "offer_end",
    )
    search_fields = ("title", "slug", "badge_text")
    ordering = ("priority", "title")
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ("categories", "collections", "candles")
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "title",
                    "slug",
                    "kind",
                    "badge_text",
                    "priority",
                    "is_active",
                )
            },
        ),
        (
            "Discount logic",
            {
                "fields": (
                    "discount_percent",
                    "discounted_price",
                )
            },
        ),
        (
            "New shopper logic",
            {
                "fields": (
                    "new_shopper_only",
                    "new_shopper_days_active",
                )
            },
        ),
        (
            "Availability window",
            {
                "fields": (
                    "offer_start",
                    "offer_end",
                )
            },
        ),
        (
            "Where offer is applied",
            {
                "fields": (
                    "apply_globally",
                    "categories",
                    "collections",
                    "candles",
                )
            },
        ),
    )


class CandleVariantInline(admin.TabularInline):
    model = CandleVariant
    extra = 1
    min_num = 0
    fields = ("size", "price", "stock_qty", "is_active")
    ordering = ("id",)


class CandleImageInline(admin.TabularInline):
    model = CandleImage
    extra = 0
    max_num = 5
    fields = ("image", "sort_order")
    ordering = ("sort_order", "id")


@admin.register(Candle)
class CandleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "is_sold_out",
        "is_bestseller",
        "created_at",
    )
    list_filter = (
        "category",
        "collections",
        "offers",
        "is_sold_out",
        "is_bestseller",
        "created_at",
    )
    search_fields = (
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
        "collections__name",
        "offers__title",
        "variants__size",
    )
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ("created_at", "in_stock")
    list_editable = ("is_sold_out", "is_bestseller")
    inlines = [CandleVariantInline, CandleImageInline]

    fieldsets = (
        (
            "Main content",
            {
                "fields": (
                    "category",
                    "name",
                    "slug",
                    "description",
                    "image",
                )
            },
        ),
        (
            "English content",
            {
                "fields": (
                    "name_en",
                    "description_en",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Russian content",
            {
                "fields": (
                    "name_ru",
                    "description_ru",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Spanish content",
            {
                "fields": (
                    "name_es",
                    "description_es",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "French content",
            {
                "fields": (
                    "name_fr",
                    "description_fr",
                ),
                "classes": ("collapse",),
            },
        ),
        ("Collections", {"fields": ("collections",)}),
        ("Offers (badges)", {"fields": ("offers",)}),
        (
            "Scent profile",
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
                "classes": ("collapse",),
            },
        ),
        (
            "Legacy pricing",
            {
                "fields": (
                    "price",
                    "stock_qty",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Status",
            {
                "fields": (
                    "is_sold_out",
                    "is_bestseller",
                    "in_stock",
                )
            },
        ),
        ("Timestamps", {"fields": ("created_at",), "classes": ("collapse",)}),
    )

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        if db_field.name in ("collections", "offers"):
            kwargs["widget"] = forms.CheckboxSelectMultiple

        return super().formfield_for_manytomany(db_field, request, **kwargs)


@admin.register(AboutGalleryItem)
class AboutGalleryItemAdmin(admin.ModelAdmin):
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
        (None, {"fields": ("title", "slug", "media_type")}),
        ("Media", {"fields": ("media", "preview_image")}),
        ("Text", {"fields": ("caption",)}),
        ("Display", {"fields": ("sort_order", "is_active")}),
        ("Timestamps", {"fields": ("created_at",), "classes": ("collapse",)}),
    )


@admin.register(AboutReviewItem)
class AboutReviewItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "customer_name",
        "sort_order",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "created_at")
    search_fields = ("title", "customer_name", "caption")
    ordering = ("sort_order", "-created_at", "id")
    list_editable = ("sort_order", "is_active")
    readonly_fields = ("created_at",)

    fieldsets = (
        (None, {"fields": ("title", "customer_name")}),
        ("Review media", {"fields": ("image",)}),
        ("Text", {"fields": ("caption",)}),
        ("Display", {"fields": ("sort_order", "is_active")}),
        ("Timestamps", {"fields": ("created_at",), "classes": ("collapse",)}),
    )