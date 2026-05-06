from django.urls import path

from .views import (
    CreateOrderAPIView,
    MyOrdersAPIView,
    CreateOrderFromCartAPIView,
    OrderDetailAPIView,
    OrderStatusUpdateAPIView,
    StaffOrdersAPIView
)
from .views_stripe import create_payment_intent, stripe_webhook

urlpatterns = [
    path("", CreateOrderAPIView.as_view(), name="create-order"),
    path("my/", MyOrdersAPIView.as_view(), name="orders-my"),
    path("staff/", StaffOrdersAPIView.as_view(), name="orders-staff"),
    
    path("from-cart/", CreateOrderFromCartAPIView.as_view(), name="create-order-from-cart"),
    path("<int:pk>/", OrderDetailAPIView.as_view(), name="order-detail"),
    path("<int:pk>/status/", OrderStatusUpdateAPIView.as_view(), name="order-status-update"),
    path("create-intent/", create_payment_intent, name="create-payment-intent"),
    path("webhook/", stripe_webhook, name="stripe-webhook"),
]