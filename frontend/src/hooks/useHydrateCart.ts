import { useEffect } from "react";
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

      try {
        if (guestItems.length > 0) {
          await mergeCart({
            items: guestItems.map((item) => ({
              variant_id: item.variant_id,
              quantity: item.quantity,
              is_gift: Boolean(item.isGift),
            })),
          });

          clearGuestCartStorage();
        }

        const serverItems = await getMyCart();

        if (!cancelled) {
          dispatch(setCart(serverItems));
        }
      } catch (error) {
        console.error("Failed to hydrate cart:", error);

        if (!cancelled) {
          dispatch(setCart(guestItems));
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [dispatch, isLoggedIn]);
}