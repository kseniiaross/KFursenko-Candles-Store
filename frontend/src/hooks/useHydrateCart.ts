import { useEffect, useRef } from "react";
import axios from "axios";

import { getMyCart, mergeCart } from "../api/cart";
import {
  clearGuestCartStorage,
  getGuestCartStorage,
  setCart,
  setGuestCart,
} from "../store/cartSlice";
import type { CartLine } from "../store/cartSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { getAccessToken } from "../utils/token";

export function useHydrateCart(): void {
  const dispatch = useAppDispatch();
  const isLoggedIn = useAppSelector((state) => Boolean(state.auth?.isLoggedIn));
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (hasHydrated.current) return;

    hasHydrated.current = true;

    let cancelled = false;

    async function hydrate(): Promise<void> {
      const token = getAccessToken();
      const guestItems = getGuestCartStorage();

      if (!isLoggedIn || !token) {
        if (!cancelled) {
          dispatch(setGuestCart(guestItems));
        }

        return;
      }

      const validGuestItems: CartLine[] = guestItems.filter((item) => {
        return (
          Number(item.variant_id) > 0 &&
          Number(item.candle_id) > 0 &&
          Number(item.quantity) > 0
        );
      });

      try {
        if (validGuestItems.length > 0) {
          try {
            await mergeCart({
              items: validGuestItems.map((item) => ({
                variant_id: Number(item.variant_id),
                quantity: Number(item.quantity),
                is_gift: Boolean(item.isGift),
              })),
            });

            clearGuestCartStorage();
          } catch (mergeError: unknown) {
            console.error("Failed to merge guest cart:", mergeError);

            if (axios.isAxiosError(mergeError)) {
              const status = mergeError.response?.status;

              if (status === 400) {
                clearGuestCartStorage();
              }
            }
          }
        }

        const serverItems = await getMyCart();

        if (!cancelled) {
          dispatch(setCart(serverItems));
          clearGuestCartStorage();
        }
      } catch (error: unknown) {
        console.error("Failed to hydrate cart:", error);

        if (!cancelled) {
          dispatch(setCart([]));
          clearGuestCartStorage();
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [dispatch, isLoggedIn]);
}