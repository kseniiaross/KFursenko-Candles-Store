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

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const totalAmount = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (item.price ?? 0) * item.quantity,
        0
      ),
    [items]
  );

  const hasGiftItems = useMemo(
    () => items.some((item) => Boolean(item.isGift)),
    [items]
  );

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
        </header>

        {items.length === 0 ? (
          <div className="cart__empty">
            <p>Your cart is empty</p>
            <Link to="/catalog">Continue Shopping</Link>
          </div>
        ) : (
          <>
            <ul className="cart__list">
              {items.map((item) => {
                const name = item.name || `Candle #${item.candle_id}`;
                const price = item.price ?? 0;

                return (
                  <li key={`${item.variant_id}-${item.size}`} className="cartItem">
                    <h2>{name}</h2>

                    <div className="cartItem__qty">
                      <button
                        onClick={() =>
                          dispatch(
                            updateQty({
                              variant_id: item.variant_id,
                              quantity: Math.max(1, item.quantity - 1),
                            })
                          )
                        }
                      >
                        −
                      </button>

                      <span>{item.quantity}</span>

                      <button
                        onClick={() =>
                          dispatch(
                            updateQty({
                              variant_id: item.variant_id,
                              quantity: item.quantity + 1,
                            })
                          )
                        }
                      >
                        +
                      </button>
                    </div>

                    <div>{money(price * item.quantity)}</div>

                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(item.isGift)}
                        onChange={(e) =>
                          dispatch(
                            setGiftOption({
                              variant_id: item.variant_id,
                              isGift: e.target.checked,
                            })
                          )
                        }
                      />
                      Gift
                    </label>

                    <button
                      onClick={() =>
                        dispatch(
                          removeFromCart({
                            variant_id: item.variant_id,
                          })
                        )
                      }
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="cart__summary">
              <div>Items: {totalItems}</div>

              {hasGiftItems && <div>Gift wrapping: Free</div>}

              <div>Total: {money(totalAmount)}</div>
            </div>

            <button
              className="cart__checkout"
              disabled={!items.length}
              onClick={handleCheckout}
            >
              CHECK OUT
            </button>
          </>
        )}
      </div>
    </main>
  );
};

export default Cart;