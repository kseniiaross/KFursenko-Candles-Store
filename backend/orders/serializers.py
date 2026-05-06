from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from candles.models import Candle
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
    candle_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=999)
    is_gift = serializers.BooleanField(required=False, default=False)

    def validate_candle_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("candle_id must be positive.")
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
            cid = int(item["candle_id"])
            qty = int(item["quantity"])
            is_gift = bool(item.get("is_gift", False))

            if cid not in merged:
                merged[cid] = {"quantity": 0, "is_gift": False}

            merged[cid]["quantity"] = int(merged[cid]["quantity"]) + qty
            merged[cid]["is_gift"] = bool(merged[cid]["is_gift"]) or is_gift

        candle_ids = list(merged.keys())
        candles = Candle.objects.select_for_update().filter(id__in=candle_ids)
        candle_map = {c.id: c for c in candles}

        if len(candle_map) != len(candle_ids):
            missing = sorted(set(candle_ids) - set(candle_map.keys()))
            raise serializers.ValidationError(
                {"items": f"Some candle_id do not exist: {missing}"}
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

        for cid, payload in merged.items():
            candle = candle_map[cid]
            qty = int(payload["quantity"])
            is_gift = bool(payload["is_gift"])

            if candle.stock_qty < qty:
                raise serializers.ValidationError(
                    {"items": f"Not enough stock for: {candle.name} (id={cid})"}
                )

            candle.stock_qty -= qty
            candle.save(update_fields=["stock_qty"])

            OrderItem.objects.create(
                order=order,
                candle=candle,
                product_name=candle.name,
                unit_price=candle.price,
                quantity=qty,
                is_gift=is_gift,
            )

            subtotal += candle.price * qty

        order.subtotal_amount = subtotal
        order.total_amount = subtotal + order.shipping_amount + order.tax_amount
        order.save(update_fields=["subtotal_amount", "total_amount"])

        return order


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)

    def validate_status(self, value: str) -> str:
        return value