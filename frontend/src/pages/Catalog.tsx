import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Candle, Category, CandleBadge } from "../types/candle";
import { listCandles, listCategories } from "../api/candles";
import { useAppDispatch } from "../store/hooks";
import { openSizeModal } from "../store/modalSlice";
import "../styles/Catalog.css";

const ITEMS_PER_PAGE = 8;

function normalizeBadges(badges?: CandleBadge[]): CandleBadge[] {
  if (!Array.isArray(badges)) return [];
  return [...badges].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
}

const Catalog: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const q = searchParams.get("q") ?? "";
  const categoryParam = searchParams.get("category") ?? "";
  const pageParam = searchParams.get("page") ?? "1";

  const page = useMemo(() => {
    const value = Number(pageParam);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }, [pageParam]);

  const categoryId = useMemo(() => {
    const numericValue = Number(categoryParam);
    return Number.isFinite(numericValue) && numericValue > 0
      ? numericValue
      : undefined;
  }, [categoryParam]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const categoriesData = await listCategories();
        if (!active) return;

        setCategories(categoriesData);

        const resolvedCategoryId = categorySlug
          ? categoriesData.find((category) => category.slug === categorySlug)?.id
          : categoryId;

        const candlesData = await listCandles({
          search: q.trim() ? q.trim() : undefined,
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
    })();

    return () => {
      active = false;
    };
  }, [q, categoryId, categorySlug, t]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(candles.length / ITEMS_PER_PAGE));
  }, [candles.length]);

  const safePage = Math.min(page, totalPages);

  const visibleCandles = useMemo(() => {
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    return candles.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [candles, safePage]);

  const updateParams = (updater: (next: URLSearchParams) => void): void => {
    const next = new URLSearchParams(searchParams);
    updater(next);
    setSearchParams(next);
  };

  const onSearchChange = (value: string): void => {
    updateParams((next) => {
      const normalizedValue = value.trimStart();

      if (normalizedValue.trim()) {
        next.set("q", normalizedValue);
      } else {
        next.delete("q");
      }

      next.delete("page");
    });
  };

  const onCategoryChange = (value: string): void => {
    updateParams((next) => {
      if (value) {
        next.set("category", value);
      } else {
        next.delete("category");
      }

      next.delete("page");
    });
  };

  const clearFilters = (): void => {
    updateParams((next) => {
      next.delete("q");
      next.delete("category");
      next.delete("page");
    });
  };

  const setPage = (nextPage: number): void => {
    updateParams((next) => {
      if (nextPage <= 1) {
        next.delete("page");
      } else {
        next.set("page", String(nextPage));
      }
    });
  };

  const hasActiveFilters = Boolean(q || categoryParam);

  const onAddToCart = (candle: Candle): void => {
    if (!candle.variants || candle.variants.length === 0) return;
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
                value={q}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={t("catalog.searchPlaceholder")}
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
            <p className="catalog__state catalog__state--error">{error}</p>
          ) : null}
        </div>

        {!loading && !error ? (
          <>
            <section
              className="catalog__grid"
              aria-label={t("catalog.productListLabel")}
            >
              {visibleCandles.map((product) => {
                const coverUrl = product.image ?? "";
                if (!coverUrl) return null;

                const destination = `/catalog/item/${product.slug}`;
                const badges = normalizeBadges(product.badges);
                const showSoldOut = Boolean(product.is_sold_out);
                const showBestseller = Boolean(product.is_bestseller);
                const firstVariant =
                  product.variants && product.variants.length > 0
                    ? product.variants[0]
                    : null;

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
                          src={coverUrl}
                          alt={product.name}
                          loading="lazy"
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
                          {firstVariant ? `$${firstVariant.price}` : "Select size"}
                        </div>
                      </Link>

                      <div className="catalogCard__actions">
                        {product.is_sold_out ? (
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

            {totalPages > 1 ? (
              <nav className="catalog__pagination" aria-label="Catalog pagination">
                <button
                  type="button"
                  className="catalog__pageBtn"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage === 1}
                >
                  Prev
                </button>

                <div className="catalog__pageInfo">
                  {safePage} / {totalPages}
                </div>

                <button
                  type="button"
                  className="catalog__pageBtn"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage === totalPages}
                >
                  Next
                </button>
              </nav>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
};

export default Catalog;