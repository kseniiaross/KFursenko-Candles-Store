from decimal import Decimal

from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from candles.models import Candle
from cart.models import Cart, CartItem
from .models import Order, OrderItem
from .serializers import OrderCreateSerializer, OrderReadSerializer, OrderStatusUpdateSerializer


class OrderCreateThrottle(UserRateThrottle):
    scope = "orders_create"


@extend_schema(
    tags=["Orders"],
    summary="Create order from provided items",
    description=(
        "Creates an order from request payload items.\n\n"
        "Body example:\n"
        '{ "items": [{"candle_id": 12, "quantity": 2}] }'
    ),
    request=OrderCreateSerializer,
    responses={201: OrderReadSerializer},
)
class CreateOrderAPIView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderCreateSerializer
    throttle_classes = [OrderCreateThrottle]

    def post(self, request, *args, **kwargs):
        items = request.data.get("items", [])
        if not items:
            raise ValidationError({"items": "Order must contain at least one item."})

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()

        return Response(OrderReadSerializer(order).data, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=["Orders"],
    summary="List my orders",
    description="Returns orders for the authenticated user only (latest first).",
    responses={200: OrderReadSerializer(many=True)},
)
class MyOrdersAPIView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderReadSerializer

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).order_by("-created_at")


@extend_schema(
    tags=["Orders"],
    summary="Staff: list all orders",
    description="Staff-only endpoint. Returns all orders in the system (latest first).",
    parameters=[
        OpenApiParameter(
            name="search",
            description="Search by order id, user email, or Stripe payment intent id (if search backend enabled).",
            required=False,
            type=str,
        ),
        OpenApiParameter(
            name="ordering",
            description="Ordering fields: created_at, total_amount, status (if ordering backend enabled). Example: -created_at",
            required=False,
            type=str,
        ),
    ],
    responses={200: OrderReadSerializer(many=True)},
)
class StaffOrdersAPIView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderReadSerializer
    search_fields = ("id", "user__email", "stripe_payment_intent_id")
    ordering_fields = ("created_at", "total_amount", "status")
    ordering = ("-created_at",)

    def get_queryset(self):
        if not self.request.user.is_staff:
            raise PermissionDenied("Only staff can view all orders.")
        return Order.objects.select_related("user").prefetch_related("items").order_by("-created_at")


@extend_schema(
    tags=["Orders"],
    summary="Create order from server cart",
    description="Creates an order from the authenticated user's server-side cart and clears the cart after success.",
    responses={201: OrderReadSerializer},
)
class CreateOrderFromCartAPIView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [OrderCreateThrottle]

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        user = request.user

        cart, _ = Cart.objects.get_or_create(user=user)
        cart_items = CartItem.objects.select_related("candle").select_for_update().filter(cart=cart)

        if not cart_items.exists():
            raise ValidationError({"cart": "Cart is empty."})

        candle_ids = list(cart_items.values_list("candle_id", flat=True))
        candles = Candle.objects.select_for_update().filter(id__in=candle_ids)
        candle_map = {c.id: c for c in candles}

        if len(candle_map) != len(set(candle_ids)):
            missing = sorted(set(candle_ids) - set(candle_map.keys()))
            raise ValidationError({"cart": f"Some candle_id do not exist: {missing}"})

        order = Order.objects.create(
            user=user,
            status=Order.Status.PENDING,
            currency="usd",
            total_amount=Decimal("0.00"),
        )

        total = Decimal("0.00")

        for item in cart_items:
            candle = candle_map[item.candle_id]
            qty = int(item.quantity)

            if candle.stock_qty < qty:
                raise ValidationError({"cart": f"Not enough stock for: {candle.name} (id={candle.id})"})

            candle.stock_qty -= qty
            candle.save(update_fields=["stock_qty"])

            OrderItem.objects.create(
                order=order,
                candle=candle,
                product_name=candle.name,
                unit_price=candle.price,
                quantity=qty,
            )

            total += candle.price * qty

        order.total_amount = total
        order.save(update_fields=["total_amount"])

        cart_items.delete()

        return Response(OrderReadSerializer(order).data, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=["Orders"],
    summary="Get my order by id",
    description="Returns a single order for the authenticated user (only their own orders).",
    responses={200: OrderReadSerializer},
)
class OrderDetailAPIView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderReadSerializer

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user)


@extend_schema(
    tags=["Orders"],
    summary="Staff: update order status",
    description='Staff-only. Updates order status using transition rules.\n\nBody: {"status": "shipped"}',
    request=OrderStatusUpdateSerializer,
    responses={200: OrderReadSerializer},
)
class OrderStatusUpdateAPIView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderStatusUpdateSerializer

    def patch(self, request, *args, **kwargs):
        if not request.user.is_staff:
            raise PermissionDenied("Only staff can update order status.")

        order_id = kwargs.get("pk")
        try:
            order = Order.objects.get(pk=order_id)
        except Order.DoesNotExist:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]

        try:
            order.transition_to(new_status)
        except ValueError as e:
            raise ValidationError({"status": str(e)})

        return Response(OrderReadSerializer(order).data, status=status.HTTP_200_OK)