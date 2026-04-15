import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listAboutReviews } from "../api/content";
import type { AboutReviewItem } from "../types/content";
import "../styles/Reviews.css";

type ReviewMediaKind = "image" | "video";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getMediaKind(item: AboutReviewItem): ReviewMediaKind {
  const mediaType = (item as AboutReviewItem & { media_type?: unknown }).media_type;

  if (mediaType === "video") {
    return "video";
  }

  return "image";
}

function getVideoSource(item: AboutReviewItem): string {
  const directMedia = (item as AboutReviewItem & { media?: unknown }).media;
  const imageFallback = (item as AboutReviewItem & { image?: unknown }).image;

  if (isNonEmptyString(directMedia)) {
    return directMedia;
  }

  if (isNonEmptyString(imageFallback)) {
    return imageFallback;
  }

  return "";
}

function getImageSource(item: AboutReviewItem): string {
  const image = (item as AboutReviewItem & { image?: unknown }).image;
  const media = (item as AboutReviewItem & { media?: unknown }).media;

  if (isNonEmptyString(image)) {
    return image;
  }

  if (isNonEmptyString(media)) {
    return media;
  }

  return "";
}

function getPosterSource(item: AboutReviewItem): string | undefined {
  const previewImage = (item as AboutReviewItem & { preview_image?: unknown }).preview_image;
  const image = (item as AboutReviewItem & { image?: unknown }).image;

  if (isNonEmptyString(previewImage)) {
    return previewImage;
  }

  if (isNonEmptyString(image)) {
    return image;
  }

  return undefined;
}

const Reviews: React.FC = () => {
  const { t } = useTranslation();

  const [items, setItems] = useState<AboutReviewItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let active = true;

    const loadReviews = async (): Promise<void> => {
      try {
        setLoading(true);
        setError("");

        const data = await listAboutReviews();

        if (!active) {
          return;
        }

        setItems(data);
      } catch {
        if (!active) {
          return;
        }

        setError(t("reviews.loadError"));
      } finally {
        if (!active) {
          return;
        }

        setLoading(false);
      }
    };

    void loadReviews();

    return () => {
      active = false;
    };
  }, [t]);

  const hasItems = useMemo(() => items.length > 0, [items]);

  return (
    <main className="reviewsPage" aria-labelledby="reviews-page-title">
      <section className="reviewsPage__hero">
        <div className="reviewsPage__container">
          <p className="reviewsPage__eyebrow">KFursenko Candles</p>

          <h1 id="reviews-page-title" className="reviewsPage__title">
            {t("reviews.title")}
          </h1>

          <p className="reviewsPage__subtitle">{t("reviews.subtitle")}</p>
        </div>
      </section>

      <section className="reviewsPage__content" aria-labelledby="reviews-page-title">
        <div className="reviewsPage__container">
          <div
            className="reviewsPage__status"
            aria-live="polite"
            aria-atomic="true"
          >
            {loading ? (
              <p className="reviewsPage__state" role="status">
                {t("reviews.loading")}
              </p>
            ) : null}

            {!loading && error ? (
              <p className="reviewsPage__state reviewsPage__state--error" role="alert">
                {error}
              </p>
            ) : null}

            {!loading && !error && !hasItems ? (
              <p className="reviewsPage__state" role="status">
                {t("reviews.empty")}
              </p>
            ) : null}
          </div>

          {!loading && !error && hasItems ? (
            <section
              className="reviewsGrid"
              aria-label={t("reviews.gridLabel")}
            >
              {items.map((item) => {
                const titleText =
                  item.title?.trim() || item.customer_name?.trim() || "";
                const captionText = item.caption?.trim() || "";
                const mediaKind = getMediaKind(item);

                return (
                  <article key={item.id} className="reviewCard">
                    <div className="reviewCard__media">
                      {mediaKind === "video" ? (
                        <video
                          className="reviewCard__video"
                          controls
                          preload="metadata"
                          playsInline
                          poster={getPosterSource(item)}
                        >
                          <source src={getVideoSource(item)} />
                        </video>
                      ) : (
                        <img
                          className="reviewCard__image"
                          src={getImageSource(item)}
                          alt={
                            titleText ||
                            item.customer_name?.trim() ||
                            t("reviews.reviewImageAlt")
                          }
                          loading="lazy"
                        />
                      )}
                    </div>

                    <div className="reviewCard__body">
                      {titleText ? (
                        <h2 className="reviewCard__title">{titleText}</h2>
                      ) : null}

                      {captionText ? (
                        <p className="reviewCard__caption">{captionText}</p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
};

export default Reviews;