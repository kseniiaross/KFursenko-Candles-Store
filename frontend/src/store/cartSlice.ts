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

const initialState: CartState = {
  items: [],
};

function findIndex(items: CartLine[], variant_id: number) {
  return items.findIndex((x) => x.variant_id === variant_id);
}

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    setCart: (state, action: PayloadAction<CartLine[]>) => {
      state.items = action.payload ?? [];
    },

    addToCart: (state, action: PayloadAction<CartLine>) => {
      const { variant_id } = action.payload;
      const idx = findIndex(state.items, variant_id);
      const qty = action.payload.quantity ?? 1;

      if (idx === -1) {
        state.items.push({
          ...action.payload,
          quantity: qty,
          isGift: Boolean(action.payload.isGift),
        });
      } else {
        state.items[idx].quantity += qty;
      }
    },

    updateQty: (
      state,
      action: PayloadAction<{
        variant_id: number;
        quantity: number;
      }>
    ) => {
      const idx = findIndex(state.items, action.payload.variant_id);

      if (idx !== -1) {
        state.items[idx].quantity = Math.max(1, action.payload.quantity);
      }
    },

    setGiftOption: (
      state,
      action: PayloadAction<{
        variant_id: number;
        isGift: boolean;
      }>
    ) => {
      const idx = findIndex(state.items, action.payload.variant_id);

      if (idx !== -1) {
        state.items[idx].isGift = action.payload.isGift;
      }
    },

    removeFromCart: (
      state,
      action: PayloadAction<{
        variant_id: number;
      }>
    ) => {
      state.items = state.items.filter(
        (x) => x.variant_id !== action.payload.variant_id
      );
    },

    clearCart: (state) => {
      state.items = [];
    },
  },
});

export const {
  setCart,
  addToCart,
  updateQty,
  setGiftOption,
  removeFromCart,
  clearCart,
} = cartSlice.actions;

export default cartSlice.reducer;