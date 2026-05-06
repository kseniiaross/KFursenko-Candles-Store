from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from candles.models import CandleVariant
from .models import Order, OrderItem


class OrderItemReadSerializer(serializers.ModelSerializer):
    candle_id = serializers.IntegerField(source="candle.id", read_only=True)
    candle_name = serializers.CharField(source="candle.name", read_only=True)

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "candle_id",
            "candle_name",
            "unit_price",
            "quantity",
            "is_gift",
        )


class OrderReadSerializer(serializers.ModelSerializer):
    items = OrderItemReadSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "status",
            "currency",
            "subtotal_amount",
            "shipping_amount",
            "tax_amount",
            "total_amount",
            "shipping_full_name",
            "shipping_line1",
            "shipping_line2",
            "shipping_city",
            "shipping_state",
            "shipping_postal_code",
            "shipping_country",
            "stripe_payment_intent_id",
            "stripe_tax_calculation_id",
            "items",
            "created_at",
        )


class OrderItemCreateSerializer(serializers.Serializer):
    variant_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=999)
    is_gift = serializers.BooleanField(required=False, default=False)

    def validate_variant_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("variant_id must be positive.")
        return value


class ShippingSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    line1 = serializers.CharField(max_length=255)
    line2 = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default="",
    )
    city = serializers.CharField(max_length=255)
    state = serializers.CharField(max_length=255)
    postal_code = serializers.CharField(max_length=32)
    country = serializers.CharField(max_length=2, default="US")

    def validate_country(self, value: str) -> str:
        v = (value or "").strip().upper()

        if len(v) != 2:
            raise serializers.ValidationError(
                "Country must be ISO 3166-1 alpha-2 (e.g., US)."
            )

        return v


class OrderCreateSerializer(serializers.Serializer):
    items = OrderItemCreateSerializer(many=True)
    shipping = ShippingSerializer()

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        user = request.user

        items_data = validated_data["items"]
        ship = validated_data["shipping"]

        merged: dict[int, dict[str, int | bool]] = {}

        for item in items_data:
            variant_id = int(item["variant_id"])
            qty = int(item["quantity"])
            is_gift = bool(item.get("is_gift", False))

            if variant_id not in merged:
                merged[variant_id] = {"quantity": 0, "is_gift": False}

            merged[variant_id]["quantity"] = int(merged[variant_id]["quantity"]) + qty
            merged[variant_id]["is_gift"] = (
                bool(merged[variant_id]["is_gift"]) or is_gift
            )

        variant_ids = list(merged.keys())

        variants = (
            CandleVariant.objects.select_for_update()
            .select_related("candle")
            .filter(id__in=variant_ids)
        )

        variant_map = {variant.id: variant for variant in variants}

        if len(variant_map) != len(variant_ids):
            missing = sorted(set(variant_ids) - set(variant_map.keys()))
            raise serializers.ValidationError(
                {"items": f"Some variant_id do not exist: {missing}"}
            )

        order = Order.objects.create(
            user=user,
            status=Order.Status.PENDING,
            currency="usd",
            subtotal_amount=Decimal("0.00"),
            shipping_amount=Decimal("15.00"),
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("0.00"),
            shipping_full_name=ship["full_name"].strip(),
            shipping_line1=ship["line1"].strip(),
            shipping_line2=(ship.get("line2") or "").strip(),
            shipping_city=ship["city"].strip(),
            shipping_state=ship["state"].strip(),
            shipping_postal_code=ship["postal_code"].strip(),
            shipping_country=ship["country"].strip().upper(),
        )

        subtotal = Decimal("0.00")

        for variant_id, payload in merged.items():
            variant = variant_map[variant_id]
            candle = variant.candle
            qty = int(payload["quantity"])
            is_gift = bool(payload["is_gift"])

            if not variant.is_active:
                raise serializers.ValidationError(
                    {"items": f"Variant is inactive: {candle.name} / {variant.size}"}
                )

            if variant.stock_qty < qty:
                raise serializers.ValidationError(
                    {
                        "items": (
                            f"Not enough stock for: {candle.name} / "
                            f"{variant.size} (variant id={variant_id})"
                        )
                    }
                )

            variant.stock_qty -= qty
            variant.save(update_fields=["stock_qty"])

            OrderItem.objects.create(
                order=order,
                candle=candle,
                product_name=f"{candle.name} - {variant.size}",
                unit_price=variant.price,
                quantity=qty,
                is_gift=is_gift,
            )

            subtotal += variant.price * qty

        order.subtotal_amount = subtotal
        order.total_amount = subtotal + order.shipping_amount + order.tax_amount
        order.save(update_fields=["subtotal_amount", "total_amount"])

        return order


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)

    def validate_status(self, value: str) -> str:
        return value