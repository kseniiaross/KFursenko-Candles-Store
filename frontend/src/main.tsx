import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import "./styles/variables.css";
import "./styles/App.css";
import App from "./App";

import { store } from "./store";
import { ThemeProvider } from "./theme/ThemeProvider";
import "./i18n";

const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY as string | undefined;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <BrowserRouter>
          {stripePromise ? (
            <Elements stripe={stripePromise}>
              <App />
            </Elements>
          ) : (
            <App />
          )}
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);