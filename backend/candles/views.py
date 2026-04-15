from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .filters import CandleFilter
from .models import (
    AboutGalleryItem,
    AboutReviewItem,
    Candle,
    Category,
    Collection,
)
from .permissions import IsStaffOrReadOnly
from .serializers import (
    AboutGalleryItemSerializer,
    AboutReviewItemSerializer,
    CandleSerializer,
    CategorySerializer,
    CollectionSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    search_fields = ["name", "slug"]
    filter_backends = [filters.SearchFilter]
    permission_classes = [IsStaffOrReadOnly]


class CollectionViewSet(viewsets.ModelViewSet):
    queryset = Collection.objects.select_related("parent").prefetch_related("children")
    serializer_class = CollectionSerializer
    search_fields = ["name", "slug"]
    filter_backends = [filters.SearchFilter]
    permission_classes = [IsStaffOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()

        root = (self.request.query_params.get("root") or "").strip()
        parent = (self.request.query_params.get("parent") or "").strip()

        if root == "1":
            return qs.filter(parent__isnull=True).order_by("name")

        if parent:
            if parent.isdigit():
                return qs.filter(parent_id=int(parent)).order_by("name")
            return qs.filter(parent__slug__iexact=parent).order_by("name")

        return qs.order_by("name")

    @action(detail=True, methods=["get"])
    def detail(self, request, pk=None):
        collection = self.get_object()

        candles_qs = (
            Candle.objects.select_related("category")
            .prefetch_related(
                "collections",
                "images",
                "variants",
                "offers",
                "direct_offers",
            )
            .distinct()
        )

        if collection.parent_id is None:
            child_ids = list(collection.children.values_list("id", flat=True))
            candles = candles_qs.filter(
                Q(collections=collection) | Q(collections__in=child_ids)
            ).distinct()
        else:
            candles = candles_qs.filter(collections=collection).distinct()

        serializer = CandleSerializer(
            candles,
            many=True,
            context={"request": request},
        )
        return Response(serializer.data)


class CandleViewSet(viewsets.ModelViewSet):
    queryset = (
        Candle.objects.select_related("category")
        .prefetch_related(
            "collections",
            "images",
            "variants",
            "offers",
            "direct_offers",
        )
        .all()
    )
    serializer_class = CandleSerializer
    lookup_field = "slug"
    permission_classes = [IsStaffOrReadOnly]

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = CandleFilter

    search_fields = [
        "name",
        "description",
        "slug",
        "collections__name",
        "category__name",
    ]
    ordering_fields = ["price", "created_at", "name"]
    ordering = ["-created_at"]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    @action(detail=True, methods=["get"])
    def collection_scents(self, request, slug=None):
        candle = self.get_object()

        child_collection = candle.collections.filter(parent__isnull=False).first()

        if not child_collection:
            child_collection = candle.collections.filter(parent__isnull=True).first()

        if not child_collection:
            return Response([])

        sibling_candles = (
            Candle.objects.select_related("category")
            .prefetch_related(
                "collections",
                "images",
                "variants",
                "offers",
                "direct_offers",
            )
            .filter(collections=child_collection)
            .exclude(id=candle.id)
            .distinct()
            .order_by("name")
        )

        serializer = CandleSerializer(
            sibling_candles,
            many=True,
            context={"request": request},
        )
        return Response(serializer.data)


class AboutGalleryItemViewSet(viewsets.ModelViewSet):
    serializer_class = AboutGalleryItemSerializer
    permission_classes = [IsStaffOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "slug", "caption"]
    ordering_fields = ["sort_order", "created_at", "title"]
    ordering = ["sort_order", "-created_at", "id"]

    def get_queryset(self):
        qs = AboutGalleryItem.objects.all()
        if self.request.user.is_staff:
            return qs.order_by("sort_order", "-created_at", "id")
        return qs.filter(is_active=True).order_by("sort_order", "-created_at", "id")


class AboutReviewItemViewSet(viewsets.ModelViewSet):
    serializer_class = AboutReviewItemSerializer
    permission_classes = [IsStaffOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "customer_name", "caption"]
    ordering_fields = ["sort_order", "created_at", "customer_name", "title"]
    ordering = ["sort_order", "-created_at", "id"]

    def get_queryset(self):
        qs = AboutReviewItem.objects.all()
        if self.request.user.is_staff:
            return qs.order_by("sort_order", "-created_at", "id")
        return qs.filter(is_active=True).order_by("sort_order", "-created_at", "id")