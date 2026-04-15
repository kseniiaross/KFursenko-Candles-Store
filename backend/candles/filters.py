import django_filters
from django.db.models import Q
from .models import Candle, Collection


class CandleFilter(django_filters.FilterSet):
    collection = django_filters.CharFilter(method="filter_collection")

    collections = django_filters.ModelMultipleChoiceFilter(
        field_name="collections",
        to_field_name="slug",
        queryset=Collection.objects.all(),
    )

    is_bestseller = django_filters.BooleanFilter(field_name="is_bestseller")
    is_sold_out = django_filters.BooleanFilter(field_name="is_sold_out")
    in_stock = django_filters.BooleanFilter(field_name="in_stock")

    class Meta:
        model = Candle
        fields = ["category", "in_stock", "is_bestseller", "is_sold_out", "collection", "collections"]

    def filter_collection(self, queryset, name, value):
        slug = (value or "").strip()
        if not slug:
            return queryset

        col = Collection.objects.filter(slug__iexact=slug).first()
        if not col:
            return queryset.filter(collections__slug__iexact=slug)

        if col.is_group:
            child_ids = list(col.children.values_list("id", flat=True))
            return queryset.filter(Q(collections=col) | Q(collections__in=child_ids)).distinct()

        return queryset.filter(collections=col).distinct()