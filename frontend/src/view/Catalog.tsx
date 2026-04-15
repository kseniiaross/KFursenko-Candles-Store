import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Candle, Category, CandleBadge } from "../types/candle";
import { listCandles, listCategories } from "../api/candles";
import { useAppDispatch } from "../store/hooks";
import { openSizeModal } from "../store/modalSlice";
import "../styles/Catalog.css";

function normalizeBadges(badges?: CandleBadge[]): CandleBadge[] {
  if (!Array.isArray(badges)) return [];
  return [...badges].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
}

const Catalog: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const q = searchParams.get("q") ?? "";
  const categoryParam = searchParams.get("category") ?? "";

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

        const [categoriesData, candlesData] = await Promise.all([
          listCategories(),
          listCandles({
            search: q.trim() ? q.trim() : undefined,
            category: categoryId,
            ordering: "-created_at",
          }),
        ]);

        if (!active) return;

        setCategories(categoriesData);
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
  }, [q, categoryId, t]);

  const onSearchChange = (value: string): void => {
    const next = new URLSearchParams(searchParams);
    const normalizedValue = value.trimStart();

    if (normalizedValue.trim()) {
      next.set("q", normalizedValue);
    } else {
      next.delete("q");
    }

    setSearchParams(next);
  };

  const onCategoryChange = (value: string): void => {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set("category", value);
    } else {
      next.delete("category");
    }

    setSearchParams(next);
  };

  const clearFilters = (): void => {
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    next.delete("category");
    setSearchParams(next);
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

              <p className="catalog__subtitle">
                Discover handcrafted candles curated for every mood and season.
              </p>
            </div>

            <Link
              className="catalog__cartLink"
              to="/cart"
              aria-label={t("catalog.goToCart")}
            >
              {t("catalog.shoppingCart")}
            </Link>
          </div>

          <form
            className="catalog__filters"
            role="search"
            aria-label={t("catalog.filtersLabel")}
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="catalog__field catalog__field--wide">
              <label className="catalog__label" htmlFor="catalog-search">
                {t("catalog.searchLabel")}
              </label>

              <input
                id="catalog-search"
                className="catalog__input"
                type="search"
                value={q}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={t("catalog.searchPlaceholder")}
              />
            </div>

            <div className="catalog__field">
              <label className="catalog__label" htmlFor="catalog-category">
                {t("catalog.categoryLabel")}
              </label>

              <select
                id="catalog-category"
                className="catalog__select"
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

            <button
              type="button"
              className="catalog__clearBtn"
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
            <div className="catalog__meta" aria-label={t("catalog.metaLabel")}>
              <span className="catalog__count">
                {t("catalog.itemsCount", { count: candles.length })}
              </span>
            </div>

            <section
              className="catalog__grid"
              aria-label={t("catalog.productListLabel")}
            >
              {candles.map((product) => {
                const coverUrl = product.image ?? "";
                if (!coverUrl) return null;

                const destination = `/catalog/${product.slug}`;
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
          </>
        ) : null}
      </div>
    </main>
  );
};

export default Catalog;