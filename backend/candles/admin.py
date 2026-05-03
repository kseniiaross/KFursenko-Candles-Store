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
        (
            "Gallery card text",
            {
                "fields": (
                    "title",
                    "slug",
                    "caption",
                ),
                "description": (
                    "This text is shown on the gallery card. "
                    "Use short editorial titles and warm brand captions."
                ),
            },
        ),
        (
            "Media upload",
            {
                "fields": (
                    "media_type",
                    "media",
                    "preview_image",
                ),
                "description": (
                    "Choose Image or Video. For videos, upload a short MP4 file. "
                    "Preview image is optional, but recommended as a video cover."
                ),
            },
        ),
        (
            "Display settings",
            {
                "fields": (
                    "sort_order",
                    "is_active",
                ),
                "description": (
                    "Use sort order to control the gallery layout. "
                    "Only active items are visible on the website."
                ),
            },
        ),
        ("Timestamps", {"fields": ("created_at",), "classes": ("collapse",)}),
    )