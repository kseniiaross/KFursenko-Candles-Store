import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getCandleBySlug, getCollectionScentsBySlug } from "../api/candles";
import { addToCart as addToCartApi } from "../api/cart";
import { useAppDispatch } from "../store/hooks";
import { setCart } from "../store/cartSlice";

import type { Candle, CandleVariant } from "../types/candle";

import "../styles/CatalogDetail.css";

const CatalogDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [item, setItem] = useState<Candle | null>(null);
  const [activeImg, setActiveImg] = useState<string>("");
  const [variant, setVariant] = useState<CandleVariant | null>(null);
  const [scents, setScents] = useState<Candle[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!slug) return;

      try {
        const data = await getCandleBySlug(slug);
        if (!active) return;

        setItem(data);
        setActiveImg(data.image ?? "");

        if (data.variants && data.variants.length > 0) {
          setVariant(data.variants[0]);
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
        setScents([]);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [slug]);

  const price = useMemo(() => {
    if (!variant) return 0;
    return Number(variant.price);
  }, [variant]);

  const onAddToCart = async (): Promise<void> => {
    if (!item || !variant || adding) return;

    try {
      setAdding(true);

      const items = await addToCartApi({
        variant_id: variant.id,
        quantity: 1,
        is_gift: false,
      });

      dispatch(setCart(items));
    } catch (error) {
      console.error("Failed to add item to cart:", error);
    } finally {
      setAdding(false);
    }
  };

  if (!item) return null;

  const gallery = [
    item.image ?? "",
    ...(item.images ?? []).map((img) => img.image),
  ].filter(Boolean);

  return (
    <main className="catalogDetail">
      <div className="catalogDetail__inner">
        <div className="catalogDetail__layout">
          <div className="catalogDetail__mediaColumn">
            <div className="catalogDetail__mediaTopRow">
              <Link to="/catalog" className="catalogDetail__back">
                ← Back to catalog
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
                <span className="catalogDetail__scentLabel">Scent</span>

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
                      onClick={() => navigate(`/catalog/${s.slug}`)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.variants && item.variants.length > 0 && (
              <div className="catalogDetail__sizeBlock">
                <span className="catalogDetail__sizeLabel">Size</span>

                <div className="catalogDetail__sizeOptions">
                  {item.variants.map((v) => (
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
              {adding ? "Adding..." : "Add to cart"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default CatalogDetail;