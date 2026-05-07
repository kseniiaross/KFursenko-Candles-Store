import React, { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { clearServerCart } from "../api/cart";
import { clearCart } from "../store/cartSlice";
import { useAppDispatch } from "../store/hooks";

import "../styles/PaymentSuccess.css";

const PaymentSuccess: React.FC = () => {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();

  const orderId = searchParams.get("order");

  useEffect(() => {
    let cancelled = false;

    async function clearAllCarts(): Promise<void> {
      dispatch(clearCart());

      try {
        localStorage.removeItem("guest_cart_items");
        sessionStorage.removeItem("guest_cart_items");
      } catch {
        // Ignore storage errors.
      }

      try {
        await clearServerCart();

        if (!cancelled) {
          dispatch(clearCart());
        }
      } catch (error) {
        console.error("Failed to clear server cart after payment:", error);
      }
    }

    void clearAllCarts();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return (
    <main className="paymentSuccess">
      <div className="paymentSuccess__inner">
        <section className="paymentSuccess__card">
          <p className="paymentSuccess__kicker">Payment</p>

          <h1 className="paymentSuccess__title">Payment successful</h1>

          <p className="paymentSuccess__description">
            Thank you. Your order has been confirmed successfully.
            {orderId ? ` Order #${orderId} is now being processed.` : ""}
            You can continue shopping or view your orders for the latest status.
          </p>

          <div className="paymentSuccess__actions">
            <Link
              to="/orders"
              className="paymentSuccess__button paymentSuccess__button--primary"
            >
              View orders
            </Link>

            <Link
              to="/catalog"
              className="paymentSuccess__button paymentSuccess__button--secondary"
            >
              Back to catalog
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
};

export default PaymentSuccess;