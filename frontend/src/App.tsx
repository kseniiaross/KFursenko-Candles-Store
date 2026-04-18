import React, { useCallback, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Header from "./pages/Header";
import Footer from "./pages/Footer";
import SizeModal from "./components/SizeModal";
import PrivateRoute from "./components/PrivateRoute";
import ScrollToTop from "./components/ScrollToTop";

import Home from "./pages/Home";
import Catalog from "./pages/Catalog";
import CatalogDetail from "./pages/CatalogDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import Orders from "./pages/Orders";

import LoginChoice from "./pages/LoginChoice";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";

import StoryMission from "./pages/StoryMission";
import Contacts from "./pages/Contacts";
import Gallery from "./pages/Gallery";
import Reviews from "./pages/Reviews";

import RecommendationQuiz from "./pages/RecommendationQuiz";
import RecommendationResult from "./pages/RecommendationResult";

import LumiereWidget from "./pages/LumiereWidget";

import Delivery from "./pages/CustomerCare/Delivery";
import Payments from "./pages/CustomerCare/Payments";
import Policy from "./pages/CustomerCare/Policy";
import Support from "./pages/Support";

import { clearAuthStorage, getAccessToken } from "./utils/token";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { logout, setUser } from "./store/authSlice";
import { useTheme } from "./theme/ThemeProvider";
import { getProfile } from "./api/auth";
import { useHydrateCart } from "./hooks/useHydrateCart";

import "./App.css";

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { theme } = useTheme();

  const isLoggedIn = useAppSelector((state) => Boolean(state.auth?.isLoggedIn));
  const firstName = useAppSelector(
    (state) => (state.auth?.user?.first_name ?? null) as string | null
  );

  useHydrateCart();

  useEffect(() => {
    const token = getAccessToken();

    if (!token) return;
    if (firstName) return;

    let isMounted = true;

    const loadProfile = async (): Promise<void> => {
      try {
        const user = await getProfile(token);

        if (!isMounted) return;
        dispatch(setUser(user));
      } catch {
        if (!isMounted) return;
        clearAuthStorage();
        dispatch(logout());
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [dispatch, firstName]);

  const handleLogout = useCallback(() => {
    clearAuthStorage();
    dispatch(logout());
  }, [dispatch]);

  const isHomePage = location.pathname === "/";

  return (
    <div
      className={`appShell ${
        isHomePage ? "appShell--home" : "appShell--inner"
      } appShell--${theme}`}
    >
      <Header
        firstName={firstName}
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
      />

      <div className="appShell__body">
        <ScrollToTop />

        <Routes>
          <Route
            path="/"
            element={<Home firstName={firstName} isLoggedIn={isLoggedIn} />}
          />

          <Route path="/catalog" element={<Catalog />} />
          <Route path="/catalog/:slug" element={<CatalogDetail />} />

          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />

          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/cancel" element={<PaymentCancel />} />

          <Route path="/orders" element={<Orders />} />

          <Route path="/login-choice" element={<LoginChoice />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/delivery" element={<Delivery />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/policy" element={<Policy />} />
          <Route path="/support" element={<Support />} />

          <Route path="/contacts" element={<Contacts />} />
          <Route path="/story-mission" element={<StoryMission />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/reviews" element={<Reviews />} />

          <Route
            path="/recommendation-quiz"
            element={<RecommendationQuiz />}
          />
          <Route
            path="/recommendation-result"
            element={<RecommendationResult />}
          />

          <Route element={<PrivateRoute />}>
            <Route path="/profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <SizeModal />
      </div>

      <Footer />
      <LumiereWidget />
    </div>
  );
};

export default App;