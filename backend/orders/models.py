from decimal import Decimal

from django.conf import settings
from django.db import models


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        CANCELED = "canceled", "Canceled"
        SHIPPED = "shipped", "Shipped"
        COMPLETED = "completed", "Completed"
        REFUNDED = "refunded", "Refunded"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="orders",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )

    currency = models.CharField(max_length=10, default="usd")

    subtotal_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    shipping_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    tax_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    shipping_full_name = models.CharField(max_length=255, blank=True, default="")
    shipping_line1 = models.CharField(max_length=255, blank=True, default="")
    shipping_line2 = models.CharField(max_length=255, blank=True, default="")
    shipping_city = models.CharField(max_length=255, blank=True, default="")
    shipping_state = models.CharField(max_length=255, blank=True, default="")
    shipping_postal_code = models.CharField(max_length=64, blank=True, default="")
    shipping_country = models.CharField(max_length=120, blank=True, default="United States")

    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, default="")
    stripe_tax_calculation_id = models.CharField(max_length=255, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["status"]),
            models.Index(fields=["created_at"]),
        ]
        ordering = ["-created_at"]

    ALLOWED_TRANSITIONS = {
        Status.PENDING: {Status.PAID, Status.CANCELED},
        Status.PAID: {Status.SHIPPED, Status.REFUNDED},
        Status.SHIPPED: {Status.COMPLETED},
        Status.COMPLETED: set(),
        Status.CANCELED: set(),
        Status.REFUNDED: set(),
    }

    def can_transition(self, new_status: str) -> bool:
        return new_status in self.ALLOWED_TRANSITIONS.get(self.status, set())

    def transition_to(self, new_status: str):
        if not self.can_transition(new_status):
            raise ValueError(f"Cannot transition from {self.status} to {new_status}")

        self.status = new_status
        self.save(update_fields=["status"])

    def __str__(self) -> str:
        return f"Order #{self.id} ({self.status})"


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
    )

    candle = models.ForeignKey(
        "candles.Candle",
        on_delete=models.PROTECT,
        related_name="order_items",
    )

    product_name = models.CharField(max_length=255)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)
    is_gift = models.BooleanField(default=False)

    def line_total(self):
        return (self.unit_price or Decimal("0.00")) * Decimal(self.quantity or 0)

    def __str__(self) -> str:
        return f"{self.product_name} x{self.quantity}"