import React from "react";
import "../../styles/CustomerCare/Delivery.css";

const Delivery: React.FC = () => {

  return (
    <main
      className="cc-page"
      aria-label="Delivery"
    >
      <section className="cc-hero" aria-label="Delivery information">
        <div className="cc-hero__inner">
          <p className="cc-hero__kicker">Customer care</p>
          <h1 className="cc-hero__title">Delivery</h1>
          <p className="cc-hero__subtitle">
            Handmade candles are made with care, we keep shipping clear and simple.
          </p>

          <div className="cc-cards" role="list">
            <article className="cc-card" role="listitem">
              <h2 className="cc-card__title">Free delivery</h2>
              <p className="cc-card__text">
                Delivery is <strong>free</strong>. No hidden fees at checkout.
              </p>
              <div className="cc-card__note">
                * We currently ship within the USA.
              </div>
            </article>

            <article className="cc-card" role="listitem">
              <h2 className="cc-card__title">Production time</h2>
              <p className="cc-card__text">
                Each order is made to order. Production takes{" "}
                <strong>3–5 business days</strong>.
              </p>
              <div className="cc-card__note">
                If we can make it faster — we will.
              </div>
            </article>

            <article className="cc-card" role="listitem">
              <h2 className="cc-card__title">Shipping time</h2>
              <p className="cc-card__text">
                Delivery time depends on your <strong>state</strong> and carrier
                load. Typical shipping is <strong>2–7 business days</strong>.
              </p>
              <div className="cc-card__note">
                You’ll see an estimated date after placing the order.
              </div>
            </article>
          </div>

          <div className="cc-panel">
            <h3 className="cc-panel__title">Quick summary</h3>

            <ul className="cc-list">
              <li className="cc-list__item">
                <span className="cc-badge">Free</span>
                <span className="cc-list__text">Delivery is free</span>
              </li>
              <li className="cc-list__item">
                <span className="cc-badge">3–5 days</span>
                <span className="cc-list__text">Production time</span>
              </li>
              <li className="cc-list__item">
                <span className="cc-badge">2–7 days</span>
                <span className="cc-list__text">Shipping time depends on state</span>
              </li>
            </ul>

            <p className="cc-panel__fine">
              If you have a special request (gift note, specific date, etc.) —
              please contact us before ordering.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Delivery;