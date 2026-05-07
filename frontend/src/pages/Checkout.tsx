// frontend/src/view/Checkout.tsx

import React, { useEffect, useId, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";

import api from "../api/axiosInstance";
import CheckoutPaymentBlock from "../components/CheckoutPaymentBlock";
import { useAppSelector } from "../store/hooks";
import { PROFILE_STORAGE_KEY } from "./Profile";

import "../styles/Checkout.css";

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

const COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "France",
  "Germany",
  "Italy",
  "Spain",
  "Australia",
  "Japan",
  "South Korea",
  "Mexico",
  "Brazil",
  "Ukraine",
  "Russia",
];

const STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "California",
  "Colorado",
  "Florida",
  "Georgia",
  "Illinois",
  "Massachusetts",
  "Maryland",
  "Nevada",
  "New Jersey",
  "New York",
  "North Carolina",
  "Pennsylvania",
  "Texas",
  "Virginia",
  "Washington",
  "Washington, D.C.",
];

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function loadProfileFromStorage(): SavedProfile | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  const fallback =
    "Could not prepare payment. Please check your information and try again.";

  if (
    typeof error !== "object" ||
    error === null ||
    !("response" in error) ||
    typeof error.response !== "object" ||
    error.response === null ||
    !("data" in error.response)
  ) {
    return fallback;
  }

  const data = error.response.data;

  if (typeof data === "string") {
    return data;
  }

  if (typeof data !== "object" || data === null) {
    return fallback;
  }

  const record = data as Record<string, unknown>;

  const shipping = record.shipping;

  if (typeof shipping === "object" && shipping !== null) {
    const shippingRecord = shipping as Record<string, unknown>;

    for (const value of Object.values(shippingRecord)) {
      if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
      }

      if (typeof value === "string") {
        return value;
      }
    }
  }

  const items = record.items;

  if (Array.isArray(items) && typeof items[0] === "string") {
    return items[0];
  }

  if (typeof items === "string") {
    return items;
  }

  const detail = record.detail;

  if (typeof detail === "string") {
    return detail;
  }

  return fallback;
}

const SHIPPING_AMOUNT = 15;

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY as
  | string
  | undefined;

const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

const Checkout: React.FC = () => {
  const navigate = useNavigate();

  const headingId = useId();
  const summaryId = useId();
  const shippingId = useId();
  const statusId = useId();

  const isLoggedIn = useAppSelector((state) => Boolean(state.auth?.isLoggedIn));

  const cartItems = useAppSelector(
    (state) => (state.cart.items ?? []) as CartLine[]
  );

  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [tax, setTax] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const savedProfile = useMemo(() => loadProfileFromStorage(), []);

  const [form, setForm] = useState<ShippingForm>({
    full_name: savedProfile
      ? [savedProfile.firstName, savedProfile.lastName]
          .filter(Boolean)
          .join(" ")
      : "",
    address_line1: savedProfile?.addressLine1 ?? "",
    address_line2: savedProfile?.apartment ?? "",
    city: savedProfile?.city ?? "",
    state: savedProfile?.state ?? "",
    postal_code: savedProfile?.postalCode ?? "",
    country: savedProfile?.country ?? "United States",
  });

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login-choice?next=/checkout", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  const items = useMemo(() => {
    return cartItems
      .map((item) => ({
        ...item,
        candle_id: Number(item.candle_id) || 0,
        variant_id: Number(item.variant_id) || 0,
        quantity: Math.max(1, Number(item.quantity) || 1),
        price: Number(item.price) || 0,
      }))
      .filter((item) => item.candle_id > 0 && item.variant_id > 0);
  }, [cartItems]);

  const subtotal = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  }, [items]);

  const itemCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const onFieldChange =
    (key: keyof ShippingForm) =>
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      setForm((prev) => ({
        ...prev,
        [key]: event.target.value,
      }));
    };

  const canPreparePayment =
    items.length > 0 &&
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
      appearance: {
        theme: "stripe" as const,
      },
    };
  }, [clientSecret]);

  const createOrderAndIntent = async (): Promise<void> => {
    if (!canPreparePayment || loading) return;

    setLoading(true);
    setErrorMsg("");
    setClientSecret("");
    setOrderId(null);
    setTax(null);
    setTotal(null);

    try {
      const orderResponse = await api.post("/orders/", {
        items: items.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
          is_gift: Boolean(item.isGift),
        })),
        shipping: {
          full_name: form.full_name.trim(),
          line1: form.address_line1.trim(),
          line2: form.address_line2.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          postal_code: form.postal_code.trim(),
          country: form.country.trim(),
        },
      });

      const createdOrderId = Number(orderResponse.data?.id);

      if (!createdOrderId) {
        throw new Error("Could not create order.");
      }

      setOrderId(createdOrderId);

      const intentResponse = await api.post(
        "/orders/create-intent/",
        {
          order_id: createdOrderId,
        }
      );

      const clientSecretValue =
        intentResponse.data?.client_secret;

      if (
        typeof clientSecretValue !== "string" ||
        !clientSecretValue.trim()
      ) {
        throw new Error("Payment initialization failed.");
      }

      setClientSecret(clientSecretValue);

      setTax(Number(intentResponse.data?.tax_amount) || 0);

      setTotal(
        Number(intentResponse.data?.total_amount) ||
          subtotal + SHIPPING_AMOUNT
      );
    } catch (error) {
      console.error("Checkout error:", error);
      setErrorMsg(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) return null;

  return (
    <main className="checkout" aria-labelledby={headingId}>
      <div className="checkout__inner">

        <datalist id="country-options">
          {COUNTRIES.map((country) => (
            <option key={country} value={country} />
          ))}
        </datalist>

        <datalist id="state-options">
          {STATES.map((state) => (
            <option key={state} value={state} />
          ))}
        </datalist>

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
            Review your items, enter your shipping details,
            and continue to secure payment.
          </p>
        </header>

        <div
          id={statusId}
          className="checkout__statusArea checkout__statusArea--page"
          aria-live="polite"
          aria-atomic="true"
        >
          {orderId !== null && (
            <div className="checkout__state">
              Order #{orderId} created.
            </div>
          )}

          {clientSecret && (
            <div className="checkout__state">
              Payment is ready.
            </div>
          )}

          {errorMsg && (
            <div
              className="checkout__state checkout__state--error"
              role="alert"
            >
              {errorMsg}
            </div>
          )}
        </div>

        <div className="checkout__grid">

          <section
            className="checkout__summary"
            aria-labelledby={summaryId}
          >
            <h2
              id={summaryId}
              className="checkout__sectionTitle"
            >
              Order summary
            </h2>

            <ul className="checkout__items" role="list">
              {items.map((item) => {
                const name =
                  item.name?.trim() ||
                  `Candle #${item.candle_id}`;

                return (
                  <li
                    key={`${item.candle_id}-${item.variant_id}`}
                    className="checkoutItem"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={name}
                        className="checkoutItem__image"
                      />
                    ) : (
                      <div
                        className="checkoutItem__image checkoutItem__image--empty"
                      />
                    )}

                    <div className="checkoutItem__info">
                      <h3 className="checkoutItem__name">
                        {name}
                      </h3>

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
                          Gift option included
                        </p>
                      )}
                    </div>

                    <div className="checkoutItem__lineTotal">
                      {money(item.price * item.quantity)}
                    </div>
                  </li>
                );
              })}
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

              <div className="checkout__totalRow">
                <span>Shipping</span>
                <span>{money(SHIPPING_AMOUNT)}</span>
              </div>

              <div className="checkout__totalRow">
                <span>Tax</span>
                <span>
                  {tax === null ? "—" : money(tax)}
                </span>
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

          <section
            className="checkout__formPanel"
            aria-labelledby={shippingId}
          >
            <h2
              id={shippingId}
              className="checkout__sectionTitle"
            >
              {showPayment
                ? "Payment"
                : "Shipping details"}
            </h2>

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
                  <label
                    className="checkoutForm__label"
                    htmlFor="checkout-full-name"
                  >
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
                    placeholder="John Smith"
                  />
                </div>

                <div className="checkoutForm__group">
                  <label
                    className="checkoutForm__label"
                    htmlFor="checkout-address-1"
                  >
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
                    placeholder="123 Madison Ave"
                  />
                </div>

                <div className="checkoutForm__row">

                  <div className="checkoutForm__group">
                    <label
                      className="checkoutForm__label"
                      htmlFor="checkout-address-2"
                    >
                      Apt / Unit
                    </label>

                    <input
                      id="checkout-address-2"
                      className="checkoutForm__input"
                      type="text"
                      autoComplete="address-line2"
                      value={form.address_line2}
                      onChange={onFieldChange("address_line2")}
                      disabled={loading}
                      placeholder="Apartment 4B"
                    />
                  </div>

                  <div className="checkoutForm__group">
                    <label
                      className="checkoutForm__label"
                      htmlFor="checkout-city"
                    >
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
                      placeholder="New York"
                    />
                  </div>
                </div>

                <div className="checkoutForm__row">

                  <div className="checkoutForm__group">
                    <label
                      className="checkoutForm__label"
                      htmlFor="checkout-state"
                    >
                      State / Region
                    </label>

                    <input
                      id="checkout-state"
                      className="checkoutForm__input"
                      type="text"
                      autoComplete="address-level1"
                      list="state-options"
                      value={form.state}
                      onChange={onFieldChange("state")}
                      disabled={loading}
                      placeholder="California"
                    />
                  </div>

                  <div className="checkoutForm__group">
                    <label
                      className="checkoutForm__label"
                      htmlFor="checkout-postal-code"
                    >
                      ZIP / Postal code
                    </label>

                    <input
                      id="checkout-postal-code"
                      className="checkoutForm__input"
                      type="text"
                      autoComplete="postal-code"
                      value={form.postal_code}
                      onChange={onFieldChange("postal_code")}
                      disabled={loading}
                      placeholder="10001"
                    />
                  </div>
                </div>

                <div className="checkoutForm__group">
                  <label
                    className="checkoutForm__label"
                    htmlFor="checkout-country"
                  >
                    Country
                  </label>

                  <input
                    id="checkout-country"
                    className="checkoutForm__input"
                    type="text"
                    autoComplete="country-name"
                    list="country-options"
                    value={form.country}
                    onChange={onFieldChange("country")}
                    disabled={loading}
                    placeholder="United States"
                  />
                </div>

                <button
                  type="submit"
                  className="checkout__button"
                  disabled={
                    loading || !canPreparePayment
                  }
                >
                  {loading
                    ? "Preparing payment..."
                    : "Continue to payment"}
                </button>
              </form>
            ) : stripePromise && stripeOptions ? (
              <Elements
                stripe={stripePromise}
                options={stripeOptions}
              >
                <CheckoutPaymentBlock
                  orderId={orderId!}
                  clientSecret={clientSecret}
                />
              </Elements>
            ) : (
              <div className="checkout__state checkout__state--error">
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