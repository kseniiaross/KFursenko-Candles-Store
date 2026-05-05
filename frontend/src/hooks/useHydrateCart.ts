import { useEffect } from "react";
import axios from "axios";

import { getMyCart, mergeCart } from "../api/cart";
import {
  clearGuestCartStorage,
  getGuestCartStorage,
  setCart,
} from "../store/cartSlice";
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

      const validGuestItems = guestItems.filter((item) => {
        return (
          Number.isInteger(item.variant_id) &&
          item.variant_id > 0 &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0
        );
      });

      try {
        if (validGuestItems.length > 0) {
          try {
            await mergeCart({
              items: validGuestItems.map((item) => ({
                variant_id: item.variant_id,
                quantity: item.quantity,
                is_gift: Boolean(item.isGift),
              })),
            });

            clearGuestCartStorage();
          } catch (mergeError) {
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
      } catch (error) {
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