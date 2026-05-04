import React, { Suspense, useCallback, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Header from "./pages/Header";
import Footer from "./pages/Footer";
import SizeModal from "./components/SizeModal";
import PrivateRoute from "./components/PrivateRoute";

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
const Gallery = React.lazy(() => import("./pages/Gallery"));

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

  return (
    <div className={`appShell appShell--${theme}`}>
      <Header
        firstName={firstName}
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
      />

      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home firstName={firstName} isLoggedIn={isLoggedIn} />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/catalog/item/:slug" element={<CatalogDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/gallery" element={<Gallery />} />

          <Route element={<PrivateRoute />}>
            <Route path="/profile" element={<div>Profile</div>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <SizeModal />
      <Footer />
    </div>
  );
};

export default App;