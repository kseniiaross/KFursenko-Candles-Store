import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { deleteCartItem, patchCartItem } from "../api/cart";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  clearGuestCartStorage,
  removeFromCart,
  setCart,
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
  const isLoggedIn = useAppSelector((state) => Boolean(state.auth.isLoggedIn));

  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const totalItems = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }, [items]);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const quantity = Math.max(1, Number(item.quantity) || 1);

      return sum + price * quantity;
    }, 0);
  }, [items]);

  const hasGiftItems = useMemo(() => {
    return items.some((item) => Boolean(item.isGift));
  }, [items]);

  const handleCheckout = (): void => {
    if (!items.length) return;

    clearGuestCartStorage();

    if (!isLoggedIn) {
      navigate("/login-choice?next=/checkout");
      return;
    }

    navigate("/checkout");
  };

  const handleRemove = async (
    variantId: number,
    itemId?: number
  ): Promise<void> => {
    dispatch(removeFromCart({ variant_id: variantId }));
    clearGuestCartStorage();

    if (!isLoggedIn || !itemId) return;

    setUpdatingId(variantId);

    try {
      const serverItems = await deleteCartItem(itemId);

      dispatch(setCart(serverItems));
      clearGuestCartStorage();
    } catch (error) {
      console.error("Failed to remove cart item from backend:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleQuantityChange = async (
    variantId: number,
    nextQuantity: number,
    itemId?: number
  ): Promise<void> => {
    const quantity = Math.max(1, Number(nextQuantity) || 1);

    dispatch(
      updateQty({
        variant_id: variantId,
        quantity,
      })
    );

    clearGuestCartStorage();

    if (!isLoggedIn || !itemId) return;

    setUpdatingId(variantId);

    try {
      const serverItems = await patchCartItem(itemId, {
        quantity,
      });

      dispatch(setCart(serverItems));
      clearGuestCartStorage();
    } catch (error) {
      console.error("Failed to update cart item quantity:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleGiftChange = async (
    variantId: number,
    isGift: boolean,
    itemId?: number
  ): Promise<void> => {
    dispatch(
      setGiftOption({
        variant_id: variantId,
        isGift,
      })
    );

    clearGuestCartStorage();

    if (!isLoggedIn || !itemId) return;

    setUpdatingId(variantId);

    try {
      const serverItems = await patchCartItem(itemId, {
        is_gift: isGift,
      });

      dispatch(setCart(serverItems));
      clearGuestCartStorage();
    } catch (error) {
      console.error("Failed to update gift option:", error);
    } finally {
      setUpdatingId(null);
    }
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
                const itemId = item.item_id;
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const price = Number(item.price) || 0;
                const name = item.name?.trim() || `Candle #${item.candle_id}`;
                const itemTotal = price * quantity;
                const isUpdating = updatingId === variantId;

                return (
                  <li
                    key={`${variantId}-${itemId ?? "local"}-${
                      item.size ?? "default"
                    }`}
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
                              disabled={isUpdating}
                              onChange={(event) => {
                                void handleGiftChange(
                                  variantId,
                                  event.target.checked,
                                  itemId
                                );
                              }}
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
                          disabled={isUpdating}
                          onClick={() => {
                            void handleRemove(variantId, itemId);
                          }}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="cartItem__bottomRow">
                        <div className="cartItem__priceBlock">
                          <span className="cartItem__priceLabel">
                            Unit Price
                          </span>

                          <span className="cartItem__price">{money(price)}</span>
                        </div>

                        <div className="cartItem__qty">
                          <button
                            type="button"
                            className="cartItem__qtyButton"
                            disabled={isUpdating || quantity <= 1}
                            onClick={() => {
                              void handleQuantityChange(
                                variantId,
                                quantity - 1,
                                itemId
                              );
                            }}
                          >
                            −
                          </button>

                          <span className="cartItem__qtyValue">{quantity}</span>

                          <button
                            type="button"
                            className="cartItem__qtyButton"
                            disabled={isUpdating}
                            onClick={() => {
                              void handleQuantityChange(
                                variantId,
                                quantity + 1,
                                itemId
                              );
                            }}
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
                  <span className="cart__summaryLabel">Items</span>
                  <span className="cart__summaryValue">{totalItems}</span>
                </div>

                {hasGiftItems && (
                  <div className="cart__summaryRow">
                    <span className="cart__summaryLabel">Gift wrapping</span>
                    <span className="cart__summaryValue">Free</span>
                  </div>
                )}

                <div className="cart__summaryRow cart__summaryRow--total">
                  <span className="cart__summaryLabel">Total</span>
                  <span className="cart__summaryValue">
                    {money(totalAmount)}
                  </span>
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