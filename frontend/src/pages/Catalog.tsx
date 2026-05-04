import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import type { Candle, Category, CandleBadge } from "../types/candle";
import {
  getDisplayPrice,
  getLowestActiveVariant,
  isCandleAvailable,
} from "../types/candle";
import { listCandles, listCategories } from "../api/candles";
import { useAppDispatch } from "../store/hooks";
import { openSizeModal } from "../store/modalSlice";

import "../styles/Catalog.css";

const ITEMS_PER_BATCH = 8;
const SEARCH_DEBOUNCE_MS = 420;

function normalizeBadges(badges?: CandleBadge[]): CandleBadge[] {
  if (!Array.isArray(badges)) return [];
  return [...badges].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
}

function buildOptimizedImageUrl(url: string, width: number): string {
  if (!url) return "";

  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    if (url.includes("/upload/f_auto") || url.includes("/upload/q_auto")) {
      return url;
    }

    return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
  }

  return url;
}

const Catalog: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(ITEMS_PER_BATCH);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const q = searchParams.get("q") ?? "";
  const categoryParam = searchParams.get("category") ?? "";

  const [searchInput, setSearchInput] = useState(q);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const categoryId = useMemo(() => {
    const numericValue = Number(categoryParam);
    return Number.isFinite(numericValue) && numericValue > 0
      ? numericValue
      : undefined;
  }, [categoryParam]);

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      const cleanSearch = searchInput.trim();

      if (cleanSearch) {
        next.set("q", cleanSearch);
      } else {
        next.delete("q");
      }

      setSearchParams(next, { replace: true });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [searchInput, setSearchParams]);

  useEffect(() => {
    let active = true;

    async function loadCatalog(): Promise<void> {
      try {
        setLoading(true);
        setError("");
        setVisibleCount(ITEMS_PER_BATCH);

        let categoriesData: Category[] = [];

        try {
          categoriesData = await listCategories();

          if (!active) return;

          setCategories(categoriesData);
        } catch {
          if (!active) return;

          setCategories([]);
        }

        const resolvedCategoryId = categorySlug
          ? categoriesData.find((category) => category.slug === categorySlug)?.id
          : categoryId;

        const candlesData = await listCandles({
          search: q.trim() || undefined,
          category: resolvedCategoryId,
          ordering: "-created_at",
        });

        if (!active) return;

        setCandles(candlesData);
      } catch {
        if (!active) return;

        setError(t("catalog.loadError"));
      } finally {
        if (!active) return;

        setLoading(false);
      }
    }

    void loadCatalog();

    return () => {
      active = false;
    };
  }, [q, categoryId, categorySlug, t]);

  const visibleCandles = useMemo(() => {
    return candles.slice(0, visibleCount);
  }, [candles, visibleCount]);

  const hasMoreCandles = visibleCount < candles.length;

  useEffect(() => {
    if (!hasMoreCandles || loading || error) return;

    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((current) =>
            Math.min(current + ITEMS_PER_BATCH, candles.length)
          );
        }
      },
      {
        root: null,
        rootMargin: "240px",
        threshold: 0,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [candles.length, error, hasMoreCandles, loading]);

  const updateParams = (updater: (next: URLSearchParams) => void): void => {
    const next = new URLSearchParams(searchParams);
    updater(next);
    setSearchParams(next, { replace: true });
  };

  const onCategoryChange = (value: string): void => {
    updateParams((next) => {
      if (value) {
        next.set("category", value);
      } else {
        next.delete("category");
      }
    });
  };

  const clearFilters = (): void => {
    setSearchInput("");

    updateParams((next) => {
      next.delete("q");
      next.delete("category");
    });
  };

  const hasActiveFilters = Boolean(q || categoryParam || searchInput.trim());

  const onAddToCart = (candle: Candle): void => {
    const variant = getLowestActiveVariant(candle);
    if (!variant) return;

    dispatch(openSizeModal(candle));
  };

  return (
    <main className="catalog" aria-labelledby="catalog-title">
      <div className="catalog__inner">
        <header className="catalog__header">
          <div className="catalog__topRow">
            <div className="catalog__headingGroup">
              <h1 id="catalog-title" className="catalog__title">
                {t("catalog.title")}
              </h1>
            </div>
          </div>

          <form
            className="catalog__filters"
            role="search"
            aria-label={t("catalog.filtersLabel")}
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="catalog__filterItem catalog__filterItem--search">
              <label className="catalog__label" htmlFor="catalog-search">
                {t("catalog.searchLabel")}
              </label>

              <input
                id="catalog-search"
                className="catalog__searchLine"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("catalog.searchPlaceholder")}
                autoComplete="off"
              />
            </div>

            <div className="catalog__filterItem catalog__filterItem--category">
              <label className="catalog__label" htmlFor="catalog-category">
                {t("catalog.categoryLabel")}
              </label>

              <div className="catalog__categoryWrap">
                <select
                  id="catalog-category"
                  className="catalog__categoryInline"
                  value={categoryParam}
                  onChange={(event) => onCategoryChange(event.target.value)}
                  disabled={categories.length === 0}
                >
                  <option value="">{t("catalog.allCategories")}</option>

                  {categories.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              className="catalog__clearInline"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              {t("catalog.clear")}
            </button>
          </form>
        </header>

        <div className="catalog__status" aria-live="polite" aria-atomic="true">
          {loading ? (
            <p className="catalog__state">{t("catalog.loading")}</p>
          ) : null}

          {!loading && error ? (
            <p className="catalog__state catalog__state--error" role="alert">
              {error}
            </p>
          ) : null}

          {!loading && !error && candles.length === 0 ? (
            <p className="catalog__state">No matching candles found.</p>
          ) : null}
        </div>

        {!loading && !error && candles.length > 0 ? (
          <>
            <section
              className="catalog__grid"
              aria-label={t("catalog.productListLabel")}
            >
              {visibleCandles.map((product, index) => {
                const coverUrl = product.image ?? "";
                if (!coverUrl) return null;

                const optimizedSmall = buildOptimizedImageUrl(coverUrl, 480);
                const optimizedMedium = buildOptimizedImageUrl(coverUrl, 800);
                const optimizedLarge = buildOptimizedImageUrl(coverUrl, 1200);

                const destination = `/catalog/item/${product.slug}`;
                const badges = normalizeBadges(product.badges);
                const available = isCandleAvailable(product);
                const showSoldOut = !available;
                const showBestseller = Boolean(product.is_bestseller);
                const displayPrice = getDisplayPrice(product);
                const firstVariant = getLowestActiveVariant(product);
                const isPriorityImage = index === 0;

                return (
                  <article key={product.id} className="catalogCard">
                    <Link
                      to={destination}
                      className="catalogCard__link"
                      aria-label={`Open ${product.name}`}
                    >
                      <div className="catalogCard__media">
                        <img
                          className="catalogCard__img"
                          src={optimizedMedium}
                          srcSet={`${optimizedSmall} 480w, ${optimizedMedium} 800w, ${optimizedLarge} 1200w`}
                          sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          alt={product.name}
                          loading={isPriorityImage ? "eager" : "lazy"}
                          fetchPriority={isPriorityImage ? "high" : "auto"}
                          decoding="async"
                          width={900}
                          height={600}
                        />

                        {(showSoldOut || showBestseller || badges.length > 0) && (
                          <div
                            className="catalogCard__badges"
                            aria-label={t("catalog.badgesLabel")}
                          >
                            {showSoldOut ? (
                              <span className="badge badge--soldout">
                                {t("catalog.soldOut")}
                              </span>
                            ) : null}

                            {showBestseller ? (
                              <span className="badge badge--bestseller">
                                {t("catalog.bestseller")}
                              </span>
                            ) : null}

                            {badges.map((badge) => (
                              <span
                                key={badge.slug}
                                className="badge badge--offer"
                                title={badge.kind}
                              >
                                {badge.badge_text}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className="catalogCard__body">
                      <Link
                        to={destination}
                        className="catalogCard__metaRow"
                        aria-label={t("catalog.productMetaLabel")}
                      >
                        <h2 className="catalogCard__name">{product.name}</h2>

                        <div className="catalogCard__price">
                          {displayPrice ? `$${displayPrice}` : "Select size"}
                        </div>
                      </Link>

                      <div className="catalogCard__actions">
                        {showSoldOut ? (
                          <button
                            type="button"
                            className="catalogCard__btn catalogCard__btn--notify"
                          >
                            {t("catalog.notifyMe")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="catalogCard__btn"
                            onClick={() => onAddToCart(product)}
                            disabled={!firstVariant}
                          >
                            {t("catalog.addToCart")}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            {hasMoreCandles ? (
              <div
                ref={loadMoreRef}
                className="catalog__loadMoreTrigger"
                aria-hidden="true"
              />
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
};

export default Catalog;