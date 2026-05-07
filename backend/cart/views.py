from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from candles.models import CandleVariant
from .models import Cart, CartItem
from .serializers import CartSerializer, CartItemSerializer, MergeCartSerializer


def _get_or_create_cart(user):
    cart, _ = Cart.objects.get_or_create(user=user)
    return (
        Cart.objects
        .prefetch_related("items__variant__candle")
        .get(pk=cart.pk)
    )


class MyCartAPIView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CartSerializer

    def get_object(self):
        return _get_or_create_cart(self.request.user)


class AddCartItemAPIView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CartItemSerializer

    def create(self, request, *args, **kwargs):
        cart = _get_or_create_cart(request.user)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        variant = serializer.validated_data["variant"]
        qty = serializer.validated_data.get("quantity", 1)
        is_gift = bool(serializer.validated_data.get("is_gift", False))

        if not variant.is_active:
            raise ValidationError({"variant_id": "This candle option is not available."})

        if variant.stock_qty < qty:
            raise ValidationError({"quantity": "Not enough stock for this candle option."})

        item, created = CartItem.objects.get_or_create(
            cart=cart,
            variant=variant,
            defaults={"quantity": qty, "is_gift": is_gift},
        )

        if not created:
            new_qty = item.quantity + qty

            if variant.stock_qty < new_qty:
                raise ValidationError({"quantity": "Not enough stock for this candle option."})

            item.quantity = new_qty
            item.is_gift = is_gift
            item.save(update_fields=["quantity", "is_gift"])

        cart = _get_or_create_cart(request.user)
        return Response(CartSerializer(cart).data, status=status.HTTP_201_CREATED)


class UpdateCartItemAPIView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CartItemSerializer

    def patch(self, request, *args, **kwargs):
        cart = _get_or_create_cart(request.user)
        item_id = kwargs.get("item_id")

        try:
            item = CartItem.objects.select_related("variant", "variant__candle").get(
                id=item_id,
                cart=cart,
            )
        except CartItem.DoesNotExist:
            return Response({"detail": "Item not found."}, status=status.HTTP_404_NOT_FOUND)

        qty = request.data.get("quantity", item.quantity)
        is_gift = request.data.get("is_gift", item.is_gift)

        try:
            qty = int(qty)
        except (TypeError, ValueError):
            raise ValidationError({"quantity": "Quantity must be a number."})

        if qty <= 0:
            item.delete()
            cart = _get_or_create_cart(request.user)
            return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)

        if item.variant.stock_qty < qty:
            raise ValidationError({"quantity": "Not enough stock for this candle option."})

        item.quantity = qty
        item.is_gift = bool(is_gift)
        item.save(update_fields=["quantity", "is_gift"])

        cart = _get_or_create_cart(request.user)
        return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)


class RemoveCartItemAPIView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, *args, **kwargs):
        cart = _get_or_create_cart(request.user)
        item_id = kwargs.get("item_id")

        CartItem.objects.filter(id=item_id, cart=cart).delete()

        cart = _get_or_create_cart(request.user)
        return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)


class MergeCartAPIView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MergeCartSerializer

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        cart = _get_or_create_cart(request.user)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        items = serializer.validated_data["items"]

        merged: dict[int, dict[str, int | bool]] = {}

        for item in items:
            variant_id = int(item["variant_id"])
            qty = int(item["quantity"])
            is_gift = bool(item.get("is_gift", False))

            if variant_id not in merged:
                merged[variant_id] = {"quantity": 0, "is_gift": False}

            merged[variant_id]["quantity"] = int(merged[variant_id]["quantity"]) + qty
            merged[variant_id]["is_gift"] = bool(merged[variant_id]["is_gift"]) or is_gift

        variant_ids = list(merged.keys())

        variants = (
            CandleVariant.objects
            .select_for_update()
            .select_related("candle")
            .filter(id__in=variant_ids)
        )

        variant_map = {variant.id: variant for variant in variants}

        if len(variant_map) != len(variant_ids):
            raise ValidationError({"items": "Some items in your cart are no longer available."})

        for variant_id, payload in merged.items():
            variant = variant_map[variant_id]
            qty = int(payload["quantity"])
            is_gift = bool(payload["is_gift"])

            if not variant.is_active:
                raise ValidationError(
                    {"items": f"{variant.candle.name} / {variant.size} is currently unavailable."}
                )

            existing = CartItem.objects.filter(cart=cart, variant=variant).first()
            final_qty = qty + (existing.quantity if existing else 0)

            if variant.stock_qty < final_qty:
                raise ValidationError(
                    {"items": f"Only {variant.stock_qty} left for {variant.candle.name} / {variant.size}."}
                )

            if existing:
                existing.quantity = final_qty
                existing.is_gift = existing.is_gift or is_gift
                existing.save(update_fields=["quantity", "is_gift"])
            else:
                CartItem.objects.create(
                    cart=cart,
                    variant=variant,
                    quantity=qty,
                    is_gift=is_gift,
                )

        cart = _get_or_create_cart(request.user)
        return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)


class ClearCartAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, *args, **kwargs):
        cart = _get_or_create_cart(request.user)
        CartItem.objects.filter(cart=cart).delete()

        cart = _get_or_create_cart(request.user)
        return Response(CartSerializer(cart).data, status=status.HTTP_200_OK)