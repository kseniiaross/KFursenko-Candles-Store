import logging

import stripe

from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, status, throttling
from rest_framework.response import Response
from rest_framework.views import APIView

from .emails import send_order_confirmation_email
from .models import Order

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeIntentUserThrottle(throttling.UserRateThrottle):
    scope = "stripe_intent_user"


class CreatePaymentIntentView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [StripeIntentUserThrottle]

    def post(self, request):
        order_id = request.data.get("order_id")

        if not order_id:
            return Response(
                {"error": "Missing order_id"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                order = (
                    Order.objects.select_for_update()
                    .filter(id=order_id, user=request.user)
                    .first()
                )

                if not order:
                    return Response(
                        {"error": "Order not found"},
                        status=status.HTTP_404_NOT_FOUND,
                    )

                if order.status != Order.Status.PENDING:
                    return Response(
                        {"error": "Order is not payable"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                amount = int(order.total_amount * 100)

                if amount < 50:
                    return Response(
                        {"error": "Order amount is too low for Stripe"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                intent = stripe.PaymentIntent.create(
                    amount=amount,
                    currency=order.currency or "usd",
                    payment_method_types=["card"],
                    metadata={
                        "order_id": str(order.id),
                        "user_id": str(request.user.id),
                    },
                )

                order.stripe_payment_intent_id = intent.id
                order.save(update_fields=["stripe_payment_intent_id"])

            return Response(
                {
                    "client_secret": intent.client_secret,
                    "total_amount": float(order.total_amount),
                    "tax_amount": float(order.tax_amount),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as error:
            logger.exception("Stripe payment intent creation failed")

            return Response(
                {"error": str(error)},
                status=status.HTTP_400_BAD_REQUEST,
            )


@csrf_exempt
def stripe_webhook(request):
    if request.method != "POST":
        return HttpResponse(status=405)

    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
    endpoint_secret = settings.STRIPE_WEBHOOK_SECRET

    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            endpoint_secret,
        )
    except ValueError:
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError:
        return HttpResponse(status=400)

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "payment_intent.succeeded":
        intent_id = data["id"]
        order_id = data["metadata"].get("order_id")
        should_send_email = False
        order_to_email = None

        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .select_related("user")
                .prefetch_related("items")
                .filter(
                    id=order_id,
                    stripe_payment_intent_id=intent_id,
                )
                .first()
            )

            if order and order.status != Order.Status.PAID:
                order.status = Order.Status.PAID
                order.save(update_fields=["status", "updated_at"])

                should_send_email = True
                order_to_email = order

        if should_send_email and order_to_email:
            try:
                send_order_confirmation_email(order_to_email)
            except Exception:
                logger.exception(
                    "Order confirmation email failed for order_id=%s",
                    order_to_email.id,
                )

    if event_type == "payment_intent.payment_failed":
        intent_id = data["id"]
        order_id = data["metadata"].get("order_id")

        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .filter(
                    id=order_id,
                    stripe_payment_intent_id=intent_id,
                )
                .first()
            )

            if order and order.status != Order.Status.CANCELED:
                order.status = Order.Status.CANCELED
                order.save(update_fields=["status", "updated_at"])

    return HttpResponse(status=200)