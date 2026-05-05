import React, { useEffect, useId, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import api from "../api/axiosInstance";
import "../styles/Checkout.css";

import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import { PROFILE_STORAGE_KEY } from "./Profile";

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
    return JSON.parse(raw) as SavedProfile;
  } catch {
    return null;
  }
}

const SHIPPING_AMOUNT = 15;

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY as
  | string
  | undefined;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

function CheckoutPaymentBlock({ orderId }: { orderId: number }) {
  const stripe = useStripe();
  const elements = useElements();

  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const onPay = async (): Promise<void> => {
    setPaymentError("");
    if (!stripe || !elements) return;
    setPaying(true);

    try {
      const returnUrl = `${window.location.origin}/payment/success?order=${encodeURIComponent(
        String(orderId)
      )}`;

      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
      });

      if (result.error) {
        setPaymentError(result.error.message ?? "Payment failed. Please try again.");
      }
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="checkoutPay">
      <div className="checkoutPay__elementWrap">
        <PaymentElement />
      </div>

      <div className="checkout__statusArea" aria-live="polite" aria-atomic="true">
        {paymentError && (
          <div className="checkout__state checkout__state--error" role="alert">
            {paymentError}
          </div>
        )}
      </div>

      <button
        type="button"
        className="checkout__button"
        onClick={onPay}
        disabled={!stripe || !elements || paying}
      >
        {paying ? "Processing..." : "Pay now"}
      </button>

      <p className="checkoutPay__note">
        We do not store card details. Payments are processed securely by Stripe.
      </p>
    </div>
  );
}

const Checkout: React.FC = () => {
  const navigate = useNavigate();

  const headingId = useId();
  const summaryId = useId();
  const shippingId = useId();
  const statusId = useId();

  const isLoggedIn = useAppSelector((state) => Boolean(state.auth?.isLoggedIn));

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

  const cartItems = useAppSelector((state) => (state.cart.items ?? []) as CartLine[]);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate(`/login-choice?next=${encodeURIComponent("/checkout")}`, {
        replace: true,
      });
    }
  }, [isLoggedIn, navigate]);

  const subtotal = useMemo(() => {
    return cartItems.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * item.quantity,
      0
    );
  }, [cartItems]);

  const itemCount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  const hasGiftItems = useMemo(() => {
    return cartItems.some((item) => Boolean(item.isGift));
  }, [cartItems]);

  const onFieldChange =
    (key: keyof ShippingForm) =>
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const canPreparePayment =
    cartItems.length > 0 &&
    form.full_name.trim().length > 0 &&
    form.address_line1.trim().length > 0 &&
    form.city.trim().length > 0 &&
    form.state.trim().length > 0 &&
    form.postal_code.trim().length > 0 &&
    form.country.trim().length > 0;

  const showPayment = Boolean(clientSecret) && orderId !== null;

  const stripeOptions = useMemo(() => {
    if (!clientSecret) return undefined;

    return {
      clientSecret,
      appearance: { theme: "stripe" as const },
    };
  }, [clientSecret]);

  const createOrderAndIntent = async (): Promise<void> => {
    if (!canPreparePayment) return;

    setLoading(true);
    setErrorMsg("");
    setClientSecret("");
    setOrderId(null);
    setTax(null);
    setTotal(null);

    try {
      const orderPayload = {
        items: cartItems.map((item) => ({
          candle_id: item.candle_id,
          quantity: item.quantity,
          size: item.size,
          is_gift: Boolean(item.isGift),
        })),
        shipping: {
          full_name: form.full_name.trim(),
          line1: form.address_line1.trim(),
          line2: form.address_line2.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          postal_code: form.postal_code.trim(),
          country: form.country.trim().toUpperCase(),
        },
        shipping_amount: SHIPPING_AMOUNT,
      };

      const orderResponse = await api.post("/orders/", orderPayload);

      const createdOrderId =
        isRecord(orderResponse.data) && typeof orderResponse.data.id === "number"
          ? orderResponse.data.id
          : null;

      if (!createdOrderId) {
        throw new Error("Order id was not returned from backend.");
      }

      setOrderId(createdOrderId);

      const intentResponse = await api.post("/orders/create-intent/", {
        order_id: createdOrderId,
      });

      const clientSecretValue = isRecord(intentResponse.data)
        ? intentResponse.data.client_secret
        : null;

      if (typeof clientSecretValue !== "string" || !clientSecretValue.trim()) {
        throw new Error("Invalid client_secret received from backend.");
      }

      setClientSecret(clientSecretValue);

      const taxAmount = isRecord(intentResponse.data)
        ? intentResponse.data.tax_amount
        : null;
      const totalAmount = isRecord(intentResponse.data)
        ? intentResponse.data.total_amount
        : null;

      if (typeof taxAmount === "number") setTax(taxAmount);
      if (typeof totalAmount === "number") setTotal(totalAmount);
    } catch (error) {
      console.error(error);
      setErrorMsg("Could not prepare payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) return null;

  return (
    <main className="checkout" aria-labelledby={headingId}>
      <div className="checkout__inner">
        <div className="checkout__backWrap">
          <Link to="/cart" className="checkout__backLink">
            ← Go back to shopping cart
          </Link>
        </div>

        <header className="checkout__header">
          <h1 id={headingId} className="checkout__title">
            Place your order
          </h1>
          <p className="checkout__subtitle">
            Review your items, enter your shipping details, and continue to secure payment.
          </p>
        </header>

        <div
          className="checkout__statusArea checkout__statusArea--page"
          id={statusId}
          aria-live="polite"
          aria-atomic="true"
        >
          {orderId !== null && (
            <div className="checkout__state">Order #{orderId} created.</div>
          )}
          {clientSecret && (
            <div className="checkout__state">Payment is ready.</div>
          )}
          {errorMsg && (
            <div className="checkout__state checkout__state--error" role="alert">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="checkout__grid">
          <section className="checkout__summary" aria-labelledby={summaryId}>
            <h2 id={summaryId} className="checkout__sectionTitle">
              Order summary
            </h2>

            {cartItems.length === 0 ? (
              <div className="checkout__empty">
                <p className="checkout__emptyText">Your cart is empty.</p>
                <Link to="/catalog" className="checkout__inlineLink">
                  Go to catalog
                </Link>
              </div>
            ) : (
              <>
                <ul className="checkout__items" role="list">
                  {cartItems.map((item) => (
                    <li
                      key={`${item.candle_id}-${item.size ?? "default"}`}
                      className="checkoutItem"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name ?? `Candle ${item.candle_id}`}
                          className="checkoutItem__image"
                          width="140"
                          height="160"
                          loading="eager"
                          decoding="async"
                        />
                      ) : (
                        <div
                          className="checkoutItem__image checkoutItem__image--empty"
                          aria-hidden="true"
                        />
                      )}

                      <div className="checkoutItem__info">
                        <h3 className="checkoutItem__name">
                          {item.name ?? `Candle #${item.candle_id}`}
                        </h3>

                        {item.size && (
                          <p className="checkoutItem__meta">Size: {item.size}</p>
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

                <div className="checkout__totals" aria-label="Order totals">
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
                      {total === null ? money(subtotal + SHIPPING_AMOUNT) : money(total)}
                    </span>
                  </div>
                </div>

                {hasGiftItems && (
                  <p className="checkout__giftNote">
                    Gift wrapping is complimentary. No extra fee is charged.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="checkout__formPanel" aria-labelledby={shippingId}>
            <h2 id={shippingId} className="checkout__sectionTitle">
              {showPayment ? "Payment" : "Shipping details"}
            </h2>

            {savedProfile?.addressLine1 && !showPayment && (
              <p className="checkout__prefillNote" aria-live="polite">
                ✓ We pre-filled your shipping address from your profile.
              </p>
            )}

            {!showPayment ? (
              <form
                className="checkoutForm"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createOrderAndIntent();
                }}
                noValidate
              >
                <div className="checkoutForm__group">
                  <label className="checkoutForm__label" htmlFor="checkout-full-name">
                    Full name
                  </label>
                  <input
                    id="checkout-full-name"
                    className="checkoutForm__input"
                    type="text"
                    autoComplete="name"
                    value={form.full_name}
                    onChange={onFieldChange("full_name")}
                    disabled={loading}
                    required
                    aria-required="true"
                  />
                </div>

                <div className="checkoutForm__group">
                  <label className="checkoutForm__label" htmlFor="checkout-address-1">
                    Street address
                  </label>
                  <input
                    id="checkout-address-1"
                    className="checkoutForm__input"
                    type="text"
                    autoComplete="address-line1"
                    value={form.address_line1}
                    onChange={onFieldChange("address_line1")}
                    disabled={loading}
                    required
                    aria-required="true"
                  />
                </div>

                <div className="checkoutForm__row">
                  <div className="checkoutForm__group">
                    <label className="checkoutForm__label" htmlFor="checkout-address-2">
                      Apt / unit
                    </label>
                    <input
                      id="checkout-address-2"
                      className="checkoutForm__input"
                      type="text"
                      autoComplete="address-line2"
                      value={form.address_line2}
                      onChange={onFieldChange("address_line2")}
                      disabled={loading}
                    />
                  </div>

                  <div className="checkoutForm__group">
                    <label className="checkoutForm__label" htmlFor="checkout-city">
                      City
                    </label>
                    <input
                      id="checkout-city"
                      className="checkoutForm__input"
                      type="text"
                      autoComplete="address-level2"
                      value={form.city}
                      onChange={onFieldChange("city")}
                      disabled={loading}
                      required
                      aria-required="true"
                    />
                  </div>
                </div>

                <div className="checkoutForm__row">
                  <div className="checkoutForm__group">
                    <label className="checkoutForm__label" htmlFor="checkout-state">
                      State
                    </label>
                    <input
                      id="checkout-state"
                      className="checkoutForm__input"
                      type="text"
                      autoComplete="address-level1"
                      value={form.state}
                      onChange={onFieldChange("state")}
                      disabled={loading}
                      required
                      aria-required="true"
                    />
                  </div>

                  <div className="checkoutForm__group">
                    <label className="checkoutForm__label" htmlFor="checkout-postal-code">
                      ZIP code
                    </label>
                    <input
                      id="checkout-postal-code"
                      className="checkoutForm__input"
                      type="text"
                      autoComplete="postal-code"
                      inputMode="text"
                      value={form.postal_code}
                      onChange={onFieldChange("postal_code")}
                      disabled={loading}
                      required
                      aria-required="true"
                    />
                  </div>
                </div>

                <div className="checkoutForm__group">
                  <label className="checkoutForm__label" htmlFor="checkout-country">
                    Country (2-letter code)
                  </label>
                  <input
                    id="checkout-country"
                    className="checkoutForm__input"
                    type="text"
                    autoComplete="country"
                    value={form.country}
                    onChange={onFieldChange("country")}
                    disabled={loading}
                    required
                    aria-required="true"
                    maxLength={2}
                  />
                </div>

                <button
                  type="submit"
                  className="checkout__button"
                  disabled={loading || !canPreparePayment || cartItems.length === 0}
                  aria-disabled={loading || !canPreparePayment}
                >
                  {loading ? "Preparing payment..." : "Continue to payment"}
                </button>
              </form>
            ) : stripePromise && stripeOptions ? (
              <Elements stripe={stripePromise} options={stripeOptions}>
                <CheckoutPaymentBlock orderId={orderId!} />
              </Elements>
            ) : (
              <div className="checkout__state checkout__state--error" role="alert">
                Stripe is not configured correctly.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

export default Checkout;