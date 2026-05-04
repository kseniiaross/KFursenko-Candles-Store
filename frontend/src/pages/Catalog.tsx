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

const Catalog: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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
    const timeout = window.setTimeout(() => {
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
      window.clearTimeout(timeout);
    };
  }, [searchInput, searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;

    async function loadCatalog(): Promise<void> {
      try {
        setLoading(true);
        setError("");
        setVisibleCount(ITEMS_PER_BATCH);

        const [categoriesData, candlesData] = await Promise.all([
          listCategories(),
          listCandles({
            search: q.trim() || undefined,
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
    }

    void loadCatalog();

    return () => {
      active = false;
    };
  }, [q, categoryId, t]);

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
          setVisibleCount((prev) =>
            Math.min(prev + ITEMS_PER_BATCH, candles.length)
          );
        }
      },
      { rootMargin: "240px" }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [candles.length, error, hasMoreCandles, loading]);

  const onAddToCart = (candle: Candle): void => {
    const variant = getLowestActiveVariant(candle);
    if (!variant) return;
    dispatch(openSizeModal(candle));
  };

  return (
    <main className="catalog">
      <div className="catalog__inner">
        <h1 className="catalog__title">{t("catalog.title")}</h1>

        <div className="catalog__grid">
          {visibleCandles.map((product, index) => {
            const coverUrl = product.image ?? "";
            if (!coverUrl) return null;

            const badges = normalizeBadges(product.badges);
            const available = isCandleAvailable(product);
            const displayPrice = getDisplayPrice(product);
            const firstVariant = getLowestActiveVariant(product);

            const isPriorityImage = index === 0;

            return (
              <article key={product.id} className="catalogCard">
                <Link to={`/catalog/item/${product.slug}`}>
                  <div className="catalogCard__media">
                    <img
                      className="catalogCard__img"
                      src={`${coverUrl}?f_auto,q_auto,w=800`}
                      srcSet={`
                        ${coverUrl}?w=400 400w,
                        ${coverUrl}?w=800 800w,
                        ${coverUrl}?w=1200 1200w
                      `}
                      sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      alt={product.name}
                      loading={isPriorityImage ? "eager" : "lazy"}
                      fetchPriority={isPriorityImage ? "high" : "auto"}
                      decoding="async"
                    />
                  </div>
                </Link>

                <div className="catalogCard__body">
                  <h2>{product.name}</h2>
                  <div>{displayPrice ? `$${displayPrice}` : "Select size"}</div>

                  <button
                    onClick={() => onAddToCart(product)}
                    disabled={!firstVariant}
                  >
                    {available ? "Add to cart" : "Sold out"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {hasMoreCandles && <div ref={loadMoreRef} />}
      </div>
    </main>
  );
};

export default Catalog;