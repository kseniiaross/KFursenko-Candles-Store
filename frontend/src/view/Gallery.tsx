import React, { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { listAboutGallery } from "../api/content";
import type { AboutGalleryItem } from "../types/content";
import "../styles/Gallery.css";

const Gallery: React.FC = () => {
  const { t } = useTranslation();

  const sectionTitleId = useId();
  const sectionSubtitleId = useId();

  const [items, setItems] = useState<AboutGalleryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let isActive = true;

    const loadGallery = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await listAboutGallery();

        if (!isActive) return;
        setItems(data);
      } catch {
        if (!isActive) return;
        setError(t("gallery.loadError"));
      } finally {
        if (!isActive) return;
        setLoading(false);
      }
    };

    void loadGallery();

    return () => {
      isActive = false;
    };
  }, [t]);

  return (
    <main
      className="galleryPage"
      aria-labelledby={sectionTitleId}
      aria-describedby={sectionSubtitleId}
    >
      <section className="galleryPage__hero">
        <div className="galleryPage__container">
          <h1 id={sectionTitleId} className="galleryPage__title">
            {t("gallery.title")}
          </h1>

          <p id={sectionSubtitleId} className="galleryPage__subtitle">
            {t("gallery.subtitle")}
          </p>
        </div>
      </section>

      <section className="galleryPage__content" aria-label={t("gallery.gridLabel")}>
        <div className="galleryPage__container">
          <div className="galleryPage__status" aria-live="polite" aria-atomic="true">
            {loading ? (
              <p className="galleryPage__state">{t("gallery.loading")}</p>
            ) : null}

            {!loading && error ? (
              <p className="galleryPage__state galleryPage__state--error" role="alert">
                {error}
              </p>
            ) : null}

            {!loading && !error && items.length === 0 ? (
              <p className="galleryPage__state">{t("gallery.empty")}</p>
            ) : null}
          </div>

          {!loading && !error && items.length > 0 ? (
            <div className="galleryGrid" role="list" aria-label={t("gallery.gridLabel")}>
              {items.map((item) => {
                const cardTitleId = `gallery-card-title-${item.id}`;
                const cardCaptionId = `gallery-card-caption-${item.id}`;

                return (
                  <article
                    key={item.id}
                    className="galleryCard"
                    role="listitem"
                    aria-labelledby={cardTitleId}
                    aria-describedby={item.caption ? cardCaptionId : undefined}
                  >
                    <div className="galleryCard__media">
                      {item.media_type === "video" ? (
                        <video
                          className="galleryCard__video"
                          controls
                          preload="metadata"
                          playsInline
                          poster={item.preview_image ?? undefined}
                        >
                          {/* Explicit MIME type helps browser media parsing */}
                          <source src={item.media} type="video/mp4" />
                          {t("gallery.videoNotSupported")}
                        </video>
                      ) : (
                        <img
                          className="galleryCard__image"
                          src={item.media}
                          alt={item.title}
                          loading="lazy"
                        />
                      )}
                    </div>

                    <div className="galleryCard__body">
                      <h2 id={cardTitleId} className="galleryCard__title">
                        {item.title}
                      </h2>

                      {item.caption ? (
                        <p id={cardCaptionId} className="galleryCard__caption">
                          {item.caption}
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
};

export default Gallery;