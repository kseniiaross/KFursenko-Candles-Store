from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    CollectionViewSet,
    CandleViewSet,
    AboutGalleryItemViewSet,
    AboutReviewItemViewSet,
)

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"collections", CollectionViewSet, basename="collection")
router.register(r"candles", CandleViewSet, basename="candle")
router.register(r"about-gallery", AboutGalleryItemViewSet, basename="about-gallery")
router.register(r"about-reviews", AboutReviewItemViewSet, basename="about-reviews")

urlpatterns = router.urls