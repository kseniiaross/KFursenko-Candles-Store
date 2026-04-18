import React from "react";
import "../styles/Sopport.css";

const Support: React.FC = () => {
  return (
    <main className="cc-page">
      <section className="cc-hero">
        <div className="cc-hero__inner">
          <p className="cc-hero__kicker">Customer Care</p>

          <h1 className="cc-hero__title">Support</h1>

          <p className="cc-hero__subtitle">
            We are here to help with product questions, orders, shipping,
            candle care, and general support requests.
          </p>

          <div className="cc-cards">
            <article className="cc-card">
              <h2 className="cc-card__title">Order Help</h2>
              <p className="cc-card__text">
                Contact us if you need help with an order, order status,
                delivery issue, or product update.
              </p>
            </article>

            <article className="cc-card">
              <h2 className="cc-card__title">Product Questions</h2>
              <p className="cc-card__text">
                Need help choosing a scent, size, or gift option? We can guide
                you to the best candle for your space.
              </p>
            </article>

            <article className="cc-card">
              <h2 className="cc-card__title">General Support</h2>
              <p className="cc-card__text">
                For any other issue, send us a message and we will get back to
                you as soon as possible.
              </p>
            </article>
          </div>

          <div className="cc-panel">
            <h2 className="cc-panel__title">How to reach us</h2>

            <div className="cc-sections">
              <section className="cc-section">
                <h3 className="cc-section__title">Support Topics</h3>

                <ul className="cc-list">
                  <li className="cc-list__item">
                    <span className="cc-badge">Orders</span>
                    <span className="cc-list__text">
                      Order confirmation, delays, updates, missing items.
                    </span>
                  </li>

                  <li className="cc-list__item">
                    <span className="cc-badge">Products</span>
                    <span className="cc-list__text">
                      Scent questions, ingredients, sizing, recommendations.
                    </span>
                  </li>

                  <li className="cc-list__item">
                    <span className="cc-badge">Shipping</span>
                    <span className="cc-list__text">
                      Delivery timing, tracking, address issues.
                    </span>
                  </li>

                  <li className="cc-list__item">
                    <span className="cc-badge">Care</span>
                    <span className="cc-list__text">
                      Burning instructions, safety, and product care.
                    </span>
                  </li>
                </ul>
              </section>

              <section className="cc-section">
                <h3 className="cc-section__title">Response Time</h3>

                <div className="cc-callout">
                  <p className="cc-callout__text">
                    We aim to respond to support requests within 1–3 business
                    days.
                  </p>

                  <ul className="cc-bullets">
                    <li>Please include your order number when applicable.</li>
                    <li>Provide clear details so we can help faster.</li>
                    <li>Check your spam folder for our reply.</li>
                  </ul>

                  <p className="cc-callout__fine">
                    Response times may be longer during holidays, launches, or
                    promotional periods.
                  </p>
                </div>
              </section>
            </div>

            <p className="cc-panel__fine">
              For urgent order-related concerns, please contact support as soon
              as possible and include all relevant details in your message.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Support;