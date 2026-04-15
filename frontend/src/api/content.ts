import api from "../api/axiosInstance";
import type { AboutGalleryItem, AboutReviewItem } from "../types/content";

export async function listAboutGallery(): Promise<AboutGalleryItem[]> {
  const response = await api.get<AboutGalleryItem[]>("/candles/about-gallery/");
  return Array.isArray(response.data) ? response.data : [];
}

export async function listAboutReviews(): Promise<AboutReviewItem[]> {
  const response = await api.get<AboutReviewItem[]>("/candles/about-reviews/");
  return Array.isArray(response.data) ? response.data : [];
}