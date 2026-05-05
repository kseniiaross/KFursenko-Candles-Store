import React, { useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import "./CheckoutPaymentBlock.css";

type CheckoutPaymentBlockProps = {
  orderId: number;
};

const CheckoutPaymentBlock: React.FC<CheckoutPaymentBlockProps> = ({
  orderId,
}) => {
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
        confirmParams: {
          return_url: returnUrl,
        },
      });

      if (result.error) {
        setPaymentError(
          result.error.message ?? "Payment failed. Please try again."
        );
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

      <div
        className="checkout__statusArea"
        aria-live="polite"
        aria-atomic="true"
      >
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
};

export default CheckoutPaymentBlock;