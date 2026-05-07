import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/axiosInstance";
import "../styles/Orders.css";

type OrderItem = {
  id: number;
  product_name?: string;
  candle_name?: string;
  quantity?: number;
  price?: string | number;
  unit_price?: string | number;
  line_total?: string | number;
  is_gift?: boolean;
};

type Order = {
  id?: number | string;
  public_id?: string;
  created_at?: string;
  status?: string;
  total_amount?: string | number;
  currency?: string;
  items?: OrderItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function safeNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function extractOrders(data: unknown): Order[] {
  if (Array.isArray(data)) {
    return data as Order[];
  }

  if (isRecord(data) && Array.isArray(data.results)) {
    return data.results as Order[];
  }

  return [];
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function formatMoney(amount: number, currency?: string): string {
  const normalizedCurrency = (currency || "USD").toUpperCase();

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: normalizedCurrency,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function getOrderDisplayId(order: Order): string {
  const publicId = safeString(order.public_id).trim();

  if (publicId) return publicId;

  if (typeof order.id === "number") return String(order.id);

  if (typeof order.id === "string" && order.id.trim()) {
    return order.id.trim();
  }

  return "—";
}

function getStatusLabel(status: string): string {
  const normalized = status.trim();

  if (!normalized) return "Processing";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

const Orders: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    let isCancelled = false;

    const fetchOrders = async (): Promise<void> => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/orders/my/");

        if (isCancelled) return;

        const extractedOrders = extractOrders(response.data);
        setOrders(extractedOrders);
      } catch {
        if (isCancelled) return;

        setOrders([]);
        setError("We couldn't load your orders right now. Please try again.");
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void fetchOrders();

    return () => {
      isCancelled = true;
    };
  }, []);

  const totalOrders = useMemo(() => orders.length, [orders]);
  const hasOrders = totalOrders > 0;

  return (
    <main className="ordersPage" aria-labelledby="orders-page-title">
      <div className="ordersPage__inner">
        <header className="ordersPage__header">
          <div className="ordersPage__heading">
            <p className="ordersPage__kicker">Account</p>

            <h1 id="orders-page-title" className="ordersPage__title">
              Orders
            </h1>

            <p className="ordersPage__subtitle">
              Review your recent purchases, order status, and item details in
              one place.
            </p>
          </div>

          <div className="ordersPage__meta" aria-label="Orders overview">
            <span className="ordersPage__count" aria-live="polite">
              {loading
                ? "Loading orders..."
                : `${totalOrders} order${totalOrders === 1 ? "" : "s"}`}
            </span>

            <Link to="/catalog" className="ordersPage__headerLink">
              Continue shopping
            </Link>
          </div>
        </header>

        {loading ? (
          <section
            className="ordersPanel"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="ordersPanel__text">Loading your orders...</p>
          </section>
        ) : null}

        {!loading && error ? (
          <section
            className="ordersPanel ordersPanel--error"
            role="alert"
            aria-live="assertive"
          >
            <p className="ordersPanel__error">{error}</p>

            <button
              type="button"
              className="ordersButton ordersButton--primary"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </section>
        ) : null}

        {!loading && !error && !hasOrders ? (
          <section className="ordersPanel" aria-labelledby="orders-empty-title">
            <h2 id="orders-empty-title" className="ordersPanel__title">
              No orders yet
            </h2>

            <p className="ordersPanel__text">
              When you place an order, it will appear here with status and item
              details.
            </p>

            <div className="ordersPanel__actions">
              <Link to="/catalog" className="ordersButton ordersButton--primary">
                Browse candles
              </Link>

              <Link
                to="/profile"
                className="ordersButton ordersButton--secondary"
              >
                Go to profile
              </Link>
            </div>
          </section>
        ) : null}

        {!loading && !error && hasOrders ? (
          <section className="ordersGrid" aria-label="Orders list">
            {orders.map((order, index) => {
              const orderDisplayId = getOrderDisplayId(order);
              const rawStatus = safeString(order.status).trim() || "processing";
              const statusLabel = getStatusLabel(rawStatus);
              const createdAt = safeString(order.created_at).trim();
              const totalAmount = safeNumber(order.total_amount);
              const currency = safeString(order.currency).trim() || "USD";
              const items = Array.isArray(order.items) ? order.items : [];

              const itemsCount = items.reduce((sum, item) => {
                const quantity = safeNumber(item.quantity);
                return sum + (quantity > 0 ? quantity : 0);
              }, 0);

              return (
                <article
                  key={`${orderDisplayId}-${index}`}
                  className="orderCard"
                  aria-labelledby={`order-title-${index}`}
                >
                  <div className="orderCard__top">
                    <div className="orderCard__identity">
                      <p className="orderCard__eyebrow">Order</p>

                      <h2 id={`order-title-${index}`} className="orderCard__id">
                        #{orderDisplayId}
                      </h2>

                      {createdAt ? (
                        <p className="orderCard__date">
                          {formatDate(createdAt)}
                        </p>
                      ) : null}
                    </div>

                    <div className="orderCard__summary" aria-label="Order summary">
                      <span
                        className="orderCard__badge"
                        data-status={rawStatus.toLowerCase()}
                      >
                        {statusLabel}
                      </span>

                      <p className="orderCard__total">
                        {formatMoney(totalAmount, currency)}
                      </p>

                      <p className="orderCard__itemsCount">
                        {itemsCount > 0
                          ? `${itemsCount} item${itemsCount === 1 ? "" : "s"}`
                          : "No items"}
                      </p>
                    </div>
                  </div>

                  {items.length > 0 ? (
                    <div className="orderCard__body">
                      <h3 className="orderCard__sectionTitle">Items</h3>

                      <ul className="orderCard__list">
                        {items.slice(0, 6).map((item) => {
                          const itemName =
                            safeString(item.product_name).trim() ||
                            safeString(item.candle_name).trim() ||
                            "Item";

                          const quantity = Math.max(1, safeNumber(item.quantity));
                          const lineTotal = safeNumber(item.line_total);
                          const unitPrice =
                            safeNumber(item.price) || safeNumber(item.unit_price);

                          const displayAmount =
                            lineTotal > 0
                              ? formatMoney(lineTotal, currency)
                              : unitPrice > 0
                                ? formatMoney(unitPrice * quantity, currency)
                                : "";

                          return (
                            <li
                              key={`${item.id}-${itemName}`}
                              className="orderLine"
                            >
                              <span className="orderLine__name">{itemName}</span>
                              <span className="orderLine__qty">{quantity} ×</span>
                              <span className="orderLine__price">
                                {displayAmount}
                              </span>
                            </li>
                          );
                        })}
                      </ul>

                      {items.length > 6 ? (
                        <p className="orderCard__more">
                          + {items.length - 6} more item
                          {items.length - 6 === 1 ? "" : "s"}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="orderCard__footer">
                    <Link to="/profile" className="orderCard__link">
                      Shipping & account
                    </Link>

                    <Link to="/contacts" className="orderCard__link">
                      Need help?
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}
      </div>
    </main>
  );
};

export default Orders;