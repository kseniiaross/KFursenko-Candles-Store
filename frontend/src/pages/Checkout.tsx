import React, { useEffect, useId, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";

import api from "../api/axiosInstance";
import CheckoutPaymentBlock from "../components/CheckoutPaymentBlock";
import { useAppSelector } from "../store/hooks";
import { PROFILE_STORAGE_KEY } from "./Profile";

import "../styles/Checkout.css";

/* ================= TYPES ================= */

type CartLine = {
  candle_id: number;
  variant_id?: number;
  name?: string;
  price?: number;
  image?: string;
  size?: string;
  quantity: number;
  isGift?: boolean;
};

type ShippingForm = {
  full_name: string;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

type SavedProfile = {
  firstName?: string;
  lastName?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

/* ================= HELPERS ================= */

const money = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const loadProfile = (): SavedProfile | null => {
  try {
    const raw = sessionStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/* ================= STRIPE ================= */

const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

/* ================= COMPONENT ================= */

const Checkout: React.FC = () => {
  const navigate = useNavigate();

  const headingId = useId();
  const summaryId = useId();
  const shippingId = useId();

  const isLoggedIn = useAppSelector((s) => Boolean(s.auth?.isLoggedIn));
  const cartItems = useAppSelector((s) => (s.cart.items ?? []) as CartLine[]);

  const [clientSecret, setClientSecret] = useState("");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ================= AUTH ================= */

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login-choice?next=/checkout", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  /* ================= NORMALIZE CART ================= */

  const items = useMemo(() => {
    return cartItems
      .map((item) => ({
        ...item,
        variant_id: Number(item.variant_id) || 0,
        quantity: Math.max(1, Number(item.quantity) || 1),
      }))
      .filter((item) => item.variant_id > 0);
  }, [cartItems]);

  const isCartValid = items.length > 0;

  /* ================= TOTAL ================= */

  const subtotal = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * item.quantity,
      0
    );
  }, [items]);

  /* ================= FORM ================= */

  const saved = useMemo(() => loadProfile(), []);

  const [form, setForm] = useState<ShippingForm>({
    full_name: saved
      ? [saved.firstName, saved.lastName].filter(Boolean).join(" ")
      : "",
    address_line1: saved?.addressLine1 ?? "",
    city: saved?.city ?? "",
    state: saved?.state ?? "",
    postal_code: saved?.postalCode ?? "",
    country: saved?.country ?? "US",
  });

  const onChange =
    (key: keyof ShippingForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const isFormValid =
    form.full_name.trim() &&
    form.address_line1.trim() &&
    form.city.trim() &&
    form.state.trim() &&
    form.postal_code.trim() &&
    form.country.trim();

  const canSubmit = isCartValid && isFormValid;

  /* ================= CREATE ORDER ================= */

  const createOrder = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setError("");

    try {
      const order = await api.post("/orders/", {
        items: items.map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
          is_gift: i.isGift,
        })),
        shipping: {
          full_name: form.full_name,
          line1: form.address_line1,
          city: form.city,
          state: form.state,
          postal_code: form.postal_code,
          country: form.country.toUpperCase(),
        },
        shipping_amount: 15,
      });

      const id = order.data?.id;
      if (!id) throw new Error("No order id");

      setOrderId(id);

      const intent = await api.post("/orders/create-intent/", {
        order_id: id,
      });

      setClientSecret(intent.data.client_secret);
    } catch (err) {
      console.error(err);
      setError("Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) return null;

  const showPayment = Boolean(clientSecret && orderId);

  /* ================= UI ================= */

  return (
    <main className="checkout" aria-labelledby={headingId}>
      <div className="checkout__inner">
        <Link to="/cart">← Back to cart</Link>

        <h1 id={headingId}>Checkout</h1>

        {error && <div className="checkout__error">{error}</div>}

        <div className="checkout__grid">
          {/* SUMMARY */}
          <section>
            <h2 id={summaryId}>Order summary</h2>

            {items.map((item) => (
              <div key={`${item.variant_id}-${item.size}`}>
                {item.name} × {item.quantity}
              </div>
            ))}

            <div>Total: {money(subtotal)}</div>
          </section>

          {/* FORM / PAYMENT */}
          <section>
            <h2 id={shippingId}>
              {showPayment ? "Payment" : "Shipping"}
            </h2>

            {!showPayment ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createOrder();
                }}
              >
                <input
                  placeholder="Full name"
                  value={form.full_name}
                  onChange={onChange("full_name")}
                />

                <input
                  placeholder="Address"
                  value={form.address_line1}
                  onChange={onChange("address_line1")}
                />

                <input
                  placeholder="City"
                  value={form.city}
                  onChange={onChange("city")}
                />

                <input
                  placeholder="State"
                  value={form.state}
                  onChange={onChange("state")}
                />

                <input
                  placeholder="ZIP"
                  value={form.postal_code}
                  onChange={onChange("postal_code")}
                />

                <button disabled={!canSubmit || loading}>
                  {loading ? "Loading..." : "Continue to payment"}
                </button>
              </form>
            ) : stripePromise ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutPaymentBlock orderId={orderId!} />
              </Elements>
            ) : (
              <div>Stripe not configured</div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

export default Checkout;