import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getCandleBySlug, getCollectionScentsBySlug } from "../api/candles";
import { addToCart as addToCartApi } from "../api/cart";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addToCart, setCart } from "../store/cartSlice";

import type { Candle, CandleVariant } from "../types/candle";

import "../styles/CatalogDetail.css";

const CatalogDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();

  const isLoggedIn = useAppSelector((state) => Boolean(state.auth?.isLoggedIn));

  const [item, setItem] = useState<Candle | null>(null);
  const [activeImg, setActiveImg] = useState<string>("");
  const [variant, setVariant] = useState<CandleVariant | null>(null);
  const [scents, setScents] = useState<Candle[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      if (!slug) return;

      try {
        const data = await getCandleBySlug(slug);

        if (!active) return;

        setItem(data);
        setActiveImg(data.image ?? "");

        const activeVariants = (data.variants ?? []).filter((v) => v.is_active);

        if (activeVariants.length > 0) {
          setVariant(activeVariants[0]);
        } else if (data.variants && data.variants.length > 0) {
          setVariant(data.variants[0]);
        } else {
          setVariant(null);
        }

        try {
          const siblings = await getCollectionScentsBySlug(slug);

          if (!active) return;

          setScents(siblings);
        } catch {
          if (!active) return;

          setScents([]);
        }
      } catch {
        if (!active) return;

        setItem(null);
        setActiveImg("");
        setVariant(null);
        setScents([]);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [slug, i18n.language]);

  const price = useMemo(() => {
    if (!variant) return 0;
    return Number(variant.price) || 0;
  }, [variant]);

  const addLocalCartItem = (): void => {
    if (!item || !variant) return;

    dispatch(
      addToCart({
        variant_id: Number(variant.id),
        candle_id: Number(item.id),
        name: item.name,
        price: Number(variant.price) || 0,
        image: item.image ?? undefined,
        size: variant.size,
        quantity: 1,
        isGift: false,
      })
    );
  };

  const onAddToCart = async (): Promise<void> => {
    if (!item || !variant || adding) return;

    const variantId = Number(variant.id);

    if (!variantId) return;

    setAdding(true);

    try {
      if (!isLoggedIn) {
        addLocalCartItem();
        return;
      }

      const serverItems = await addToCartApi({
        variant_id: variantId,
        quantity: 1,
        is_gift: false,
      });

      if (Array.isArray(serverItems) && serverItems.length > 0) {
        dispatch(setCart(serverItems));
        return;
      }

      addLocalCartItem();
    } catch (error) {
      console.error("Failed to add item to cart:", error);
      addLocalCartItem();
    } finally {
      setAdding(false);
    }
  };

  if (!item) return null;

  const gallery = [
    item.image ?? "",
    ...(item.images ?? []).map((img) => img.image),
  ].filter(Boolean);

  const variants = item.variants ?? [];

  return (
    <main className="catalogDetail" aria-label={t("catalogDetail.pageLabel")}>
      <div className="catalogDetail__inner">
        <div className="catalogDetail__layout">
          <div className="catalogDetail__mediaColumn">
            <div className="catalogDetail__mediaTopRow">
              <Link to="/catalog" className="catalogDetail__back">
                ← {t("catalogDetail.backToCatalog")}
              </Link>
            </div>

            <div className="catalogDetail__media">
              <div className="catalogDetail__mainImgWrap">
                <img
                  src={activeImg}
                  className="catalogDetail__mainImg"
                  alt={item.name}
                />
              </div>

              <div className="catalogDetail__thumbs">
                {gallery.map((img) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => setActiveImg(img)}
                    className={`catalogDetail__thumb ${
                      img === activeImg ? "is-active" : ""
                    }`}
                    aria-label={`${t("catalogDetail.selectImage")}: ${
                      item.name
                    }`}
                  >
                    <img src={img} alt={item.name} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="catalogDetail__info">
            <h1 className="catalogDetail__title">{item.name}</h1>

            <p className="catalogDetail__price">${price.toFixed(2)}</p>

            {scents.length > 0 && (
              <div className="catalogDetail__scentBlock">
                <span className="catalogDetail__scentLabel">
                  {t("catalogDetail.collectionScents")}
                </span>

                <div className="catalogDetail__scentOptions">
                  <button
                    type="button"
                    className="catalogDetail__scentBtn is-active"
                    aria-current="true"
                  >
                    {item.name}
                  </button>

                  {scents.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="catalogDetail__scentBtn"
                      onClick={() => navigate(`/catalog/item/${s.slug}`)}
                      aria-label={`${t("catalogDetail.openScent")}: ${s.name}`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {variants.length > 0 && (
              <div className="catalogDetail__sizeBlock">
                <span className="catalogDetail__sizeLabel">Size</span>

                <div className="catalogDetail__sizeOptions">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVariant(v)}
                      className={`catalogDetail__sizeBtn ${
                        variant?.id === v.id ? "is-active" : ""
                      }`}
                    >
                      {v.size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="catalogDetail__desc">{item.description}</p>

            <button
              type="button"
              className="catalogDetail__btn"
              onClick={() => {
                void onAddToCart();
              }}
              disabled={!variant || adding}
            >
              {adding ? "Adding..." : t("catalogDetail.addToCart")}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default CatalogDetail;