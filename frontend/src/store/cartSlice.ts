import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export type CartLine = {
  item_id?: number;
  variant_id: number;
  candle_id: number;
  name?: string;
  price: number;
  image?: string;
  size?: string;
  quantity: number;
  isGift?: boolean;
};

type CartState = {
  items: CartLine[];
};

const STORAGE_KEY = "guest_cart_items";

/* ================= STORAGE ================= */

function normalizeCartLine(item: CartLine): CartLine {
  return {
    ...item,
    item_id: item.item_id ? Number(item.item_id) : undefined,
    variant_id: Number(item.variant_id) || 0,
    candle_id: Number(item.candle_id) || 0,
    quantity: Math.max(1, Number(item.quantity) || 1),
    price: Number(item.price) || 0,
    isGift: Boolean(item.isGift),
  };
}

function loadGuestCart(): CartLine[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeCartLine(item as CartLine))
      .filter((item) => item.variant_id > 0 && item.candle_id > 0);
  } catch {
    return [];
  }
}

function saveGuestCart(items: CartLine[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage failures.
  }
}

function clearGuestCartStorageInternal(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function getGuestCartStorage(): CartLine[] {
  return loadGuestCart();
}

export function clearGuestCartStorage(): void {
  clearGuestCartStorageInternal();
}

/* ================= HELPERS ================= */

function findIndex(items: CartLine[], variant_id: number): number {
  return items.findIndex((item) => Number(item.variant_id) === Number(variant_id));
}

/* ================= SLICE ================= */

const initialState: CartState = {
  items: loadGuestCart(),
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    // Important:
    // setCart is for server cart / Redux memory.
    // It must NOT save to guest localStorage.
    setCart: (state, action: PayloadAction<CartLine[]>) => {
      state.items = (action.payload ?? [])
        .map(normalizeCartLine)
        .filter((item) => item.variant_id > 0 && item.candle_id > 0);
    },

    setGuestCart: (state, action: PayloadAction<CartLine[]>) => {
      state.items = (action.payload ?? [])
        .map(normalizeCartLine)
        .filter((item) => item.variant_id > 0 && item.candle_id > 0);

      saveGuestCart(state.items);
    },

    addToCart: (state, action: PayloadAction<CartLine>) => {
      const item = normalizeCartLine(action.payload);

      if (!item.variant_id || !item.candle_id) return;

      const idx = findIndex(state.items, item.variant_id);

      if (idx === -1) {
        state.items.push(item);
      } else {
        state.items[idx].quantity += item.quantity;
      }

      saveGuestCart(state.items);
    },

    updateQty: (
      state,
      action: PayloadAction<{
        variant_id: number;
        quantity: number;
      }>
    ) => {
      const variant_id = Number(action.payload.variant_id) || 0;
      const idx = findIndex(state.items, variant_id);

      if (idx === -1) return;

      state.items[idx].quantity = Math.max(1, Number(action.payload.quantity) || 1);
      saveGuestCart(state.items);
    },

    setGiftOption: (
      state,
      action: PayloadAction<{
        variant_id: number;
        isGift: boolean;
      }>
    ) => {
      const variant_id = Number(action.payload.variant_id) || 0;
      const idx = findIndex(state.items, variant_id);

      if (idx === -1) return;

      state.items[idx].isGift = Boolean(action.payload.isGift);
      saveGuestCart(state.items);
    },

    removeFromCart: (
      state,
      action: PayloadAction<{
        variant_id: number;
      }>
    ) => {
      const variant_id = Number(action.payload.variant_id) || 0;

      state.items = state.items.filter(
        (item) => Number(item.variant_id) !== variant_id
      );

      saveGuestCart(state.items);
    },

    clearCart: (state) => {
      state.items = [];
      clearGuestCartStorageInternal();
    },
  },
});

export const {
  setCart,
  setGuestCart,
  addToCart,
  updateQty,
  setGiftOption,
  removeFromCart,
  clearCart,
} = cartSlice.actions;

export default cartSlice.reducer;