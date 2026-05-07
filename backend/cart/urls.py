from django.urls import path

from .views import (
    MyCartAPIView,
    AddCartItemAPIView,
    UpdateCartItemAPIView,
    RemoveCartItemAPIView,
    MergeCartAPIView,
    ClearCartAPIView,
)

urlpatterns = [
    path("my/", MyCartAPIView.as_view(), name="cart-my"),
    path("items/add/", AddCartItemAPIView.as_view(), name="cart-item-add"),
    path("items/<int:item_id>/", UpdateCartItemAPIView.as_view(), name="cart-item-update"),
    path("items/<int:item_id>/delete/", RemoveCartItemAPIView.as_view(), name="cart-item-delete"),
    path("merge/", MergeCartAPIView.as_view(), name="cart-merge"),
    path("clear/", ClearCartAPIView.as_view(), name="cart-clear"),
]