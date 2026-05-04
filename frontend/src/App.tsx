import React, { Suspense, useCallback, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Header from "./pages/Header";
import Footer from "./pages/Footer";
import SizeModal from "./components/SizeModal";
import PrivateRoute from "./components/PrivateRoute";
import ScrollToTop from "./components/ScrollToTop";
import LumiereWidget from "./pages/LumiereWidget";

import { clearAuthStorage, getAccessToken } from "./utils/token";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { logout, setUser } from "./store/authSlice";
import { useTheme } from "./theme/ThemeProvider";
import { getProfile } from "./api/auth";
import { useHydrateCart } from "./hooks/useHydrateCart";

const Home = React.lazy(() => import("./pages/Home"));
const Catalog = React.lazy(() => import("./pages/Catalog"));
const CatalogDetail = React.lazy(() => import("./pages/CatalogDetail"));
const Cart = React.lazy(() => import("./pages/Cart"));
const Checkout = React.lazy(() => import("./pages/Checkout"));
const PaymentSuccess = React.lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancel = React.lazy(() => import("./pages/PaymentCancel"));
const Orders = React.lazy(() => import("./pages/Orders"));
const LoginChoice = React.lazy(() => import("./pages/LoginChoice"));
const Login = React.lazy(() => import("./pages/Login"));
const Register = React.lazy(() => import("./pages/Register"));
const Profile = React.lazy(() => import("./pages/Profile"));
const StoryMission = React.lazy(() => import("./pages/StoryMission"));
const Contacts = React.lazy(() => import("./pages/Contacts"));
const Gallery = React.lazy(() => import("./pages/Gallery"));
const Reviews = React.lazy(() => import("./pages/Reviews"));
const RecommendationQuiz = React.lazy(() => import("./pages/RecommendationQuiz"));
const RecommendationResult = React.lazy(() => import("./pages/RecommendationResult"));
const Delivery = React.lazy(() => import("./pages/CustomerCare/Delivery"));
const Payments = React.lazy(() => import("./pages/CustomerCare/Payments"));
const Policy = React.lazy(() => import("./pages/CustomerCare/Policy"));
const Support = React.lazy(() => import("./pages/CustomerCare/Support"));

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { theme } = useTheme();

  const isLoggedIn = useAppSelector((state) => Boolean(state.auth?.isLoggedIn));
  const firstName = useAppSelector(
    (state) => state.auth?.user?.first_name ?? null
  );

  useHydrateCart();

  useEffect(() => {
    const token = getAccessToken();
    if (!token || firstName) return;

    let isMounted = true;

    const loadProfile = async () => {
      try {
        const user = await getProfile();
        if (isMounted) dispatch(setUser(user));
      } catch {
        if (isMounted) {
          clearAuthStorage();
          dispatch(logout());
        }
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

        <Suspense fallback={null}>
          <Routes>
            <Route
              path="/"
              element={<Home firstName={firstName} isLoggedIn={isLoggedIn} />}
            />

            <Route path="/catalog" element={<Catalog />} />
            <Route path="/catalog/category/:categorySlug" element={<Catalog />} />
            <Route path="/catalog/item/:slug" element={<CatalogDetail />} />

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

            <Route path="/recommendation-quiz" element={<RecommendationQuiz />} />
            <Route
              path="/recommendation-result"
              element={<RecommendationResult />}
            />

            <Route element={<PrivateRoute />}>
              <Route path="/profile" element={<Profile />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>

        <SizeModal />
      </div>

      <Footer />
      <LumiereWidget />
    </div>
  );
};

export default App;