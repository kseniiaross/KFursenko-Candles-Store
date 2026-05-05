import React, { useEffect, useId, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";

import api from "../api/axiosInstance";
import CheckoutPaymentBlock from "../components/CheckoutPaymentBlock";
import { useAppSelector } from "../store/hooks";
import { PROFILE_STORAGE_KEY } from "./Profile";

import "../styles/Checkout.css";

/* ======================================================
   TYPES
   ====================================================== */

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
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

type SavedProfile = {
  firstName?: string;
  lastName?: string;
  addressLine1?: string;
  apartment?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

/* ======================================================
   HELPERS
   ====================================================== */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function loadProfileFromStorage(): SavedProfile | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  if (isRecord(error) && isRecord(error.response) && error.response.data) {
    return JSON.stringify(error.response.data);
  }
  return "Could not prepare payment. Please try again.";
}

/* ======================================================
   CONSTANTS
   ====================================================== */

const SHIPPING_AMOUNT = 15;

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

/* ======================================================
   COMPONENT
   ====================================================== */

const Checkout: React.FC = () => {
  const navigate = useNavigate();

  const headingId = useId();
  const summaryId = useId();
  const shippingId = useId();

  const isLoggedIn = useAppSelector((s) => Boolean(s.auth?.isLoggedIn));
  const cartItems = useAppSelector((s) => (s.cart.items ?? []) as CartLine[]);

  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [tax, setTax] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const savedProfile = useMemo(() => loadProfileFromStorage(), []);

  const [form, setForm] = useState<ShippingForm>({
    full_name: savedProfile
      ? [savedProfile.firstName, savedProfile.lastName].filter(Boolean).join(" ")
      : "",
    address_line1: savedProfile?.addressLine1 ?? "",
    address_line2: savedProfile?.apartment ?? "",
    city: savedProfile?.city ?? "",
    state: savedProfile?.state ?? "",
    postal_code: savedProfile?.postalCode ?? "",
    country: savedProfile?.country ?? "US",
  });

  /* ======================================================
     AUTH REDIRECT
     ====================================================== */

  useEffect(() => {
    if (!isLoggedIn) {
      navigate(`/login-choice?next=/checkout`, { replace: true });
    }
  }, [isLoggedIn, navigate]);

  /* ======================================================
     NORMALIZED CART
     ====================================================== */

  const normalizedCartItems = useMemo(() => {
    return cartItems.map((item) => ({
      ...item,
      variant_id:
        typeof item.variant_id === "number"
          ? item.variant_id
          : Number(item.variant_id),
      quantity: Number(item.quantity) || 1,
    }));
  }, [cartItems]);

  const hasValidCartItems = useMemo(() => {
    return normalizedCartItems.every(
      (item) => item.variant_id && item.variant_id > 0 && item.quantity > 0
    );
  }, [normalizedCartItems]);

  /* ======================================================
     CALCULATIONS
     ====================================================== */

  const subtotal = useMemo(() => {
    return normalizedCartItems.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * item.quantity,
      0
    );
  }, [normalizedCartItems]);

  const itemCount = useMemo(() => {
    return normalizedCartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [normalizedCartItems]);

  const hasGiftItems = useMemo(() => {
    return normalizedCartItems.some((item) => item.isGift);
  }, [normalizedCartItems]);

  /* ======================================================
     FORM
     ====================================================== */

  const onFieldChange =
    (key: keyof ShippingForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const canPreparePayment =
    normalizedCartItems.length > 0 &&
    hasValidCartItems &&
    form.full_name.trim() !== "" &&
    form.address_line1.trim() !== "" &&
    form.city.trim() !== "" &&
    form.state.trim() !== "" &&
    form.postal_code.trim() !== "" &&
    form.country.trim() !== "";

  const showPayment = Boolean(clientSecret && orderId);

  const stripeOptions = useMemo(() => {
    if (!clientSecret) return;
    return { clientSecret, appearance: { theme: "stripe" as const } };
  }, [clientSecret]);

  /* ======================================================
     CREATE ORDER
     ====================================================== */

  const createOrderAndIntent = async () => {
    if (!canPreparePayment) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const orderResponse = await api.post("/orders/", {
        items: normalizedCartItems.map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
          is_gift: i.isGift,
        })),
        shipping: {
          full_name: form.full_name,
          line1: form.address_line1,
          line2: form.address_line2,
          city: form.city,
          state: form.state,
          postal_code: form.postal_code,
          country: form.country.toUpperCase(),
        },
        shipping_amount: SHIPPING_AMOUNT,
      });

      const id = orderResponse.data?.id;
      if (!id) throw new Error("No order id");

      setOrderId(id);

      const intent = await api.post("/orders/create-intent/", {
        order_id: id,
      });

      setClientSecret(intent.data.client_secret);
      setTax(intent.data.tax_amount);
      setTotal(intent.data.total_amount);
    } catch (e) {
      console.error(e);
      setErrorMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) return null;

  /* ======================================================
     UI
     ====================================================== */

  return (
    <main className="checkout" aria-labelledby={headingId}>
      <div className="checkout__inner">
        <Link to="/cart" className="checkout__backLink">
          ← Back to cart
        </Link>

        <h1 id={headingId} className="checkout__title">
          Place your order
        </h1>

        {errorMsg && (
          <div className="checkout__state checkout__state--error">
            {errorMsg}
          </div>
        )}

        <div className="checkout__grid">
          {/* SUMMARY */}
          <section className="checkout__summary" aria-labelledby={summaryId}>
            <h2 id={summaryId} className="checkout__sectionTitle">
              Order summary
            </h2>

            <ul className="checkout__items">
              {normalizedCartItems.map((item) => (
                <li key={item.variant_id} className="checkoutItem">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="checkoutItem__image"
                    />
                  )}

                  <div className="checkoutItem__info">
                    <h3 className="checkoutItem__name">{item.name}</h3>

                    {item.size && (
                      <p className="checkoutItem__meta">
                        Size: {item.size}
                      </p>
                    )}

                    <p className="checkoutItem__meta">
                      Quantity: {item.quantity}
                    </p>

                    {item.isGift && (
                      <p className="checkoutItem__meta">
                        Gift option: Yes — Free
                      </p>
                    )}
                  </div>

                  <div className="checkoutItem__lineTotal">
                    {money((Number(item.price) || 0) * item.quantity)}
                  </div>
                </li>
              ))}
            </ul>

            <div className="checkout__totals">
              <div className="checkout__totalRow">
                <span>Items</span>
                <span>{itemCount}</span>
              </div>

              <div className="checkout__totalRow">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>

              {hasGiftItems && (
                <div className="checkout__totalRow">
                  <span>Gift wrapping</span>
                  <span>Free</span>
                </div>
              )}

              <div className="checkout__totalRow">
                <span>Shipping</span>
                <span>{money(SHIPPING_AMOUNT)}</span>
              </div>

              <div className="checkout__totalRow">
                <span>Tax</span>
                <span>{tax === null ? "—" : money(tax)}</span>
              </div>

              <div className="checkout__totalRow checkout__totalRow--grand">
                <span>Total</span>
                <span>
                  {total === null
                    ? money(subtotal + SHIPPING_AMOUNT)
                    : money(total)}
                </span>
              </div>
            </div>
          </section>

          {/* FORM / PAYMENT */}
          <section className="checkout__formPanel" aria-labelledby={shippingId}>
            <h2 id={shippingId} className="checkout__sectionTitle">
              {showPayment ? "Payment" : "Shipping details"}
            </h2>

            {!showPayment ? (
              <form
                className="checkoutForm"
                onSubmit={(e) => {
                  e.preventDefault();
                  createOrderAndIntent();
                }}
              >
                <input
                  className="checkoutForm__input"
                  placeholder="Full name"
                  value={form.full_name}
                  onChange={onFieldChange("full_name")}
                />

                <input
                  className="checkoutForm__input"
                  placeholder="Address"
                  value={form.address_line1}
                  onChange={onFieldChange("address_line1")}
                />

                <input
                  className="checkoutForm__input"
                  placeholder="City"
                  value={form.city}
                  onChange={onFieldChange("city")}
                />

                <input
                  className="checkoutForm__input"
                  placeholder="State"
                  value={form.state}
                  onChange={onFieldChange("state")}
                />

                <input
                  className="checkoutForm__input"
                  placeholder="ZIP"
                  value={form.postal_code}
                  onChange={onFieldChange("postal_code")}
                />

                <button
                  className="checkout__button"
                  disabled={
                    loading ||
                    !canPreparePayment ||
                    normalizedCartItems.length === 0
                  }
                >
                  {loading ? "Preparing..." : "Continue to payment"}
                </button>
              </form>
            ) : stripePromise && stripeOptions ? (
              <Elements stripe={stripePromise} options={stripeOptions}>
                <CheckoutPaymentBlock orderId={orderId!} />
              </Elements>
            ) : (
              <div className="checkout__state checkout__state--error">
                Stripe error
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

export default Checkout;