import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getCandleBySlug, getCollectionScentsBySlug } from "../api/candles";
import { useAppDispatch } from "../store/hooks";
import { addToCart } from "../store/cartSlice";

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

  useEffect(() => {
    async function load() {
      if (!slug) return;

      const data = await getCandleBySlug(slug);
      setItem(data);
      setActiveImg(data.image ?? "");

      if (data.variants && data.variants.length > 0) {
        setVariant(data.variants[0]);
      }

      // Load sibling scents from same sub-collection
      try {
        const siblings = await getCollectionScentsBySlug(slug);
        setScents(siblings);
      } catch {
        setScents([]);
      }
    }

    load();
  }, [slug]);

  const price = useMemo(() => {
    if (!variant) return 0;
    return Number(variant.price);
  }, [variant]);

  const onAddToCart = () => {
    if (!item || !variant) return;
    dispatch(
      addToCart({
        variant_id: variant.id,
        candle_id: item.id,
        name: item.name,
        price: Number(variant.price),
        size: variant.size,
        image: activeImg || item.image || "",
        quantity: 1,
      })
    );
  };

  if (!item) return null;

  const gallery = [
    item.image ?? "",
    ...(item.images ?? []).map((img) => img.image),
  ].filter(Boolean);

  return (
    <main className="catalogDetail">
      <div className="catalogDetail__inner">

        <Link to="/catalog" className="catalogDetail__back">
          ← Back to catalog
        </Link>

        <div className="catalogDetail__layout">

          {/* LEFT — IMAGES */}
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
                  onClick={() => setActiveImg(img)}
                  className={`catalogDetail__thumb ${img === activeImg ? "is-active" : ""}`}
                >
                  <img src={img} alt={item.name} />
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT — INFO */}
          <div className="catalogDetail__info">
            <h1 className="catalogDetail__title">{item.name}</h1>

            <p className="catalogDetail__price">${price.toFixed(2)}</p>

            {/* SCENT SELECTOR — siblings from same collection */}
            {scents.length > 0 && (
              <div className="catalogDetail__scentBlock">
                <span className="catalogDetail__scentLabel">Scent</span>
                <div className="catalogDetail__scentOptions">
                  {/* Current scent */}
                  <button
                    className="catalogDetail__scentBtn is-active"
                    aria-current="true"
                  >
                    {item.name}
                  </button>

                  {/* Sibling scents */}
                  {scents.map((s) => (
                    <button
                      key={s.id}
                      className="catalogDetail__scentBtn"
                      onClick={() => navigate(`/catalog/${s.slug}`)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SIZE SELECTOR */}
            {item.variants && item.variants.length > 0 && (
              <div className="catalogDetail__sizeBlock">
                <span className="catalogDetail__sizeLabel">Size</span>
                <div className="catalogDetail__sizeOptions">
                  {item.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVariant(v)}
                      className={`catalogDetail__sizeBtn ${variant?.id === v.id ? "is-active" : ""}`}
                    >
                      {v.size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="catalogDetail__desc">{item.description}</p>

            <button className="catalogDetail__btn" onClick={onAddToCart}>
              Add to cart
            </button>
          </div>

        </div>
      </div>
    </main>
  );
};

export default CatalogDetail;