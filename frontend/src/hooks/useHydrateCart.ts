import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setCart } from "../store/cartSlice";
import { getMyCart } from "../api/cart";

export function useHydrateCart(): void {
  const dispatch = useAppDispatch();
  const isLoggedIn = useAppSelector((state) => Boolean(state.auth?.isLoggedIn));

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!isLoggedIn) {
        dispatch(setCart([]));
        return;
      }

      try {
        const items = await getMyCart();
        if (!cancelled) {
          dispatch(setCart(items));
        }
      } catch (error) {
        console.error("Failed to hydrate cart:", error);
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [dispatch, isLoggedIn]);
}