from django.urls import path

from .views import LumiereReplyView, LumiereSearchView

urlpatterns = [
    path("reply/", LumiereReplyView.as_view(), name="lumiere-reply"),
    path("search/", LumiereSearchView.as_view(), name="lumiere-search"),
]