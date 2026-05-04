from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    CollectionViewSet,
    CandleViewSet,
    GalleryItemViewSet,
)

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"collections", CollectionViewSet, basename="collection")
router.register(r"candles", CandleViewSet, basename="candle")
router.register(r"gallery", GalleryItemViewSet, basename="gallery")

urlpatterns = router.urls