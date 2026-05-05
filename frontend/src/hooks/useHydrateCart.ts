import { useEffect } from "react";
import axios from "axios";

import { getMyCart, mergeCart } from "../api/cart";
import {
  clearGuestCartStorage,
  getGuestCartStorage,
  setCart,
} from "../store/cartSlice";
import type { CartLine } from "../store/cartSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { getAccessToken } from "../utils/token";

export function useHydrateCart(): void {
  const dispatch = useAppDispatch();
  const isLoggedIn = useAppSelector((state) => Boolean(state.auth?.isLoggedIn));

  useEffect(() => {
    let cancelled = false;

    async function hydrate(): Promise<void> {
      const token = getAccessToken();
      const guestItems = getGuestCartStorage();

      if (!isLoggedIn || !token) {
        if (!cancelled) {
          dispatch(setCart(guestItems));
        }

        return;
      }

      const validGuestItems: CartLine[] = guestItems.filter((item: CartLine) => {
        return (
          Number.isInteger(Number(item.variant_id)) &&
          Number(item.variant_id) > 0 &&
          Number.isInteger(Number(item.quantity)) &&
          Number(item.quantity) > 0
        );
      });

      try {
        if (validGuestItems.length > 0) {
          try {
            await mergeCart({
              items: validGuestItems.map((item: CartLine) => ({
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
        } else if (guestItems.length > 0) {
          clearGuestCartStorage();
        }

        const serverItems = await getMyCart();

        if (!cancelled) {
          dispatch(setCart(serverItems));
        }
      } catch (error: unknown) {
        console.error("Failed to hydrate cart:", error);

        if (!cancelled) {
          dispatch(setCart([]));
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [dispatch, isLoggedIn]);
}