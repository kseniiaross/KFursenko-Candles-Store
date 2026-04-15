from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from cloudinary.models import CloudinaryField


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 2

            while Category.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            self.slug = slug

        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Collection(models.Model):
    name = models.CharField(max_length=140, unique=True)
    slug = models.SlugField(max_length=160, unique=True, blank=True)
    is_group = models.BooleanField(default=False)

    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="children",
    )

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 2

            while Collection.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            self.slug = slug

        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Offer(models.Model):
    class Kind(models.TextChoices):
        NEW_SHOPPER = "new_shopper", "New shopper"
        DISCOUNT = "discount", "Discount percent"
        DISCOUNTED_CANDLES = "discounted_candles", "Discounted candles"
        B1G2 = "b1g2", "Buy 1 get 2"
        HOLIDAY = "holiday", "Holiday offer"
        LOYALTY = "loyalty", "Loyalty"

    title = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True, blank=True)
    badge_text = models.CharField(max_length=40, blank=True)

    kind = models.CharField(
        max_length=30,
        choices=Kind.choices,
        default=Kind.DISCOUNT,
    )

    discount_percent = models.PositiveSmallIntegerField(null=True, blank=True)
    discounted_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Optional final fixed price for discounted candles.",
    )

    priority = models.PositiveSmallIntegerField(default=100)
    is_active = models.BooleanField(default=True)

    new_shopper_only = models.BooleanField(default=False)
    new_shopper_days_active = models.PositiveSmallIntegerField(
        default=60,
        help_text="How many days after registration new shopper offer is valid.",
    )

    apply_globally = models.BooleanField(default=False)

    categories = models.ManyToManyField(Category, blank=True, related_name="offers")
    collections = models.ManyToManyField(Collection, blank=True, related_name="offers")
    candles = models.ManyToManyField("Candle", blank=True, related_name="direct_offers")

    offer_start = models.DateTimeField(null=True, blank=True)
    offer_end = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["priority", "title"]

    def __str__(self):
        return self.title

    def clean(self):
        if self.offer_start and self.offer_end and self.offer_start >= self.offer_end:
            raise ValidationError("offer_end must be later than offer_start.")

        if self.discount_percent is not None:
            if self.discount_percent <= 0 or self.discount_percent >= 100:
                raise ValidationError("discount_percent must be between 1 and 99.")

        if self.discounted_price is not None and self.discounted_price <= Decimal("0"):
            raise ValidationError("discounted_price must be greater than 0.")

    @property
    def is_currently_active(self):
        if not self.is_active:
            return False

        now = timezone.now()

        if self.offer_start and now < self.offer_start:
            return False

        if self.offer_end and now > self.offer_end:
            return False

        return True

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title) or "offer"
            slug = base_slug
            counter = 2

            while Offer.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            self.slug = slug

        if not self.badge_text:
            if self.kind == self.Kind.DISCOUNT and self.discount_percent:
                self.badge_text = f"-{self.discount_percent}%"
            elif self.kind == self.Kind.NEW_SHOPPER:
                self.badge_text = "New shopper"
            elif self.kind == self.Kind.HOLIDAY:
                self.badge_text = "Holiday offer"
            elif self.kind == self.Kind.B1G2:
                self.badge_text = "Buy 1 get 2"

        self.full_clean()
        super().save(*args, **kwargs)


class Candle(models.Model):
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="candles",
    )

    collections = models.ManyToManyField(
        Collection,
        related_name="candles",
        blank=True,
    )

    offers = models.ManyToManyField(
        Offer,
        related_name="candles_m2m",
        blank=True,
    )

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    description = models.TextField(blank=True)
    image = CloudinaryField("image", blank=True, null=True)

    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    stock_qty = models.PositiveIntegerField(default=0, blank=True)
    in_stock = models.BooleanField(default=False)

    is_sold_out = models.BooleanField(default=False)
    is_bestseller = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 2

            while Candle.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            self.slug = slug

        self.in_stock = not self.is_sold_out
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class CandleVariant(models.Model):
    candle = models.ForeignKey(
        Candle,
        on_delete=models.CASCADE,
        related_name="variants",
    )

    size = models.CharField(
        max_length=50,
        help_text="Example: 8 oz, 11.3 oz",
    )

    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    stock_qty = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("candle", "size")
        ordering = ("id",)

    def __str__(self):
        return f"{self.candle.name} - {self.size}"


class CandleImage(models.Model):
    candle = models.ForeignKey(
        Candle,
        on_delete=models.CASCADE,
        related_name="images",
    )
    image = CloudinaryField("image")
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ("sort_order", "id")

    def __str__(self):
        return f"{self.candle.name} #{self.id}"


class AboutGalleryItem(models.Model):
    class MediaType(models.TextChoices):
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"

    title = models.CharField(max_length=180)
    slug = models.SlugField(max_length=200, unique=True, blank=True)

    media_type = models.CharField(
        max_length=20,
        choices=MediaType.choices,
        default=MediaType.IMAGE,
    )

    media = CloudinaryField("media", resource_type="auto")
    preview_image = CloudinaryField("preview_image", blank=True, null=True)

    caption = models.TextField(blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("sort_order", "-created_at", "id")

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title) or "about-gallery-item"
            slug = base_slug
            counter = 2

            while AboutGalleryItem.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            self.slug = slug

        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class AboutReviewItem(models.Model):
    title = models.CharField(max_length=180, blank=True)
    customer_name = models.CharField(max_length=120, blank=True)
    image = CloudinaryField("image")
    caption = models.TextField(blank=True)

    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("sort_order", "-created_at", "id")

    def __str__(self):
        label = self.title.strip() if self.title else ""

        if label:
            return label

        if self.customer_name.strip():
            return f"Review by {self.customer_name}"

        return f"Review #{self.pk or 'new'}"