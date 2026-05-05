import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  removeFromCart,
  setGiftOption,
  updateQty,
} from "../store/cartSlice";

import "../styles/Cart.css";

const money = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const items = useAppSelector((state) => state.cart.items);
  const isLoggedIn = useAppSelector((state) => state.auth.isLoggedIn);

  const totalItems = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }, [items]);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 1;

      return sum + price * quantity;
    }, 0);
  }, [items]);

  const hasGiftItems = useMemo(() => {
    return items.some((item) => Boolean(item.isGift));
  }, [items]);

  const handleCheckout = () => {
    if (!items.length) return;

    if (!isLoggedIn) {
      navigate("/login-choice?next=/checkout");
      return;
    }

    navigate("/checkout");
  };

  return (
    <main className="cart">
      <div className="cart__inner">
        <header className="cart__header">
          <h1 className="cart__title">SHOPPING CART</h1>

          <p className="cart__subtitle">
            Review your selected candles before checkout
          </p>
        </header>

        {items.length === 0 ? (
          <div className="cart__empty">
            <p>Your cart is empty</p>

            <Link to="/catalog" className="cart__emptyLink">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
            <ul className="cart__list">
              {items.map((item) => {
                const variantId = Number(item.variant_id);
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const price = Number(item.price) || 0;
                const name = item.name?.trim() || `Candle #${item.candle_id}`;
                const itemTotal = price * quantity;

                return (
                  <li
                    key={`${variantId}-${item.size ?? "default"}`}
                    className="cartItem"
                  >
                    <div className="cartItem__imageWrap">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={name}
                          className="cartItem__image"
                          width="180"
                          height="210"
                          loading="eager"
                          decoding="async"
                        />
                      ) : (
                        <div className="cartItem__image cartItem__image--empty" />
                      )}
                    </div>

                    <div className="cartItem__content">
                      <div className="cartItem__topRow">
                        <div className="cartItem__titleGroup">
                          <h2 className="cartItem__name">{name}</h2>

                          {item.size && (
                            <p className="cartItem__meta">Size: {item.size}</p>
                          )}

                          <label className="cartItem__giftOption">
                            <input
                              type="checkbox"
                              checked={Boolean(item.isGift)}
                              onChange={(event) =>
                                dispatch(
                                  setGiftOption({
                                    variant_id: variantId,
                                    isGift: event.target.checked,
                                  })
                                )
                              }
                            />

                            <span>
                              It&apos;s a gift — complimentary gift wrapping
                            </span>
                          </label>

                          {item.isGift && (
                            <p className="cartItem__meta">Gift wrapping: Free</p>
                          )}
                        </div>

                        <button
                          type="button"
                          className="cartItem__remove"
                          onClick={() =>
                            dispatch(
                              removeFromCart({
                                variant_id: variantId,
                              })
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>

                      <div className="cartItem__bottomRow">
                        <div className="cartItem__priceBlock">
                          <span className="cartItem__priceLabel">
                            Unit Price
                          </span>

                          <span className="cartItem__price">
                            {money(price)}
                          </span>
                        </div>

                        <div className="cartItem__qty">
                          <button
                            type="button"
                            className="cartItem__qtyButton"
                            onClick={() =>
                              dispatch(
                                updateQty({
                                  variant_id: variantId,
                                  quantity: Math.max(1, quantity - 1),
                                })
                              )
                            }
                          >
                            −
                          </button>

                          <span className="cartItem__qtyValue">{quantity}</span>

                          <button
                            type="button"
                            className="cartItem__qtyButton"
                            onClick={() =>
                              dispatch(
                                updateQty({
                                  variant_id: variantId,
                                  quantity: quantity + 1,
                                })
                              )
                            }
                          >
                            +
                          </button>
                        </div>

                        <div className="cartItem__lineTotalBlock">
                          <span className="cartItem__priceLabel">Total</span>

                          <span className="cartItem__lineTotal">
                            {money(itemTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <section className="cart__footer">
              <div className="cart__summary">
                <div className="cart__summaryRow">
                  <span>Items</span>
                  <span>{totalItems}</span>
                </div>

                {hasGiftItems && (
                  <div className="cart__summaryRow">
                    <span>Gift wrapping</span>
                    <span>Free</span>
                  </div>
                )}

                <div className="cart__summaryRow cart__summaryRow--total">
                  <span>Total</span>
                  <span>{money(totalAmount)}</span>
                </div>
              </div>

              <button
                type="button"
                className="cart__checkout"
                disabled={!items.length}
                onClick={handleCheckout}
              >
                CHECK OUT
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
};

export default Cart;