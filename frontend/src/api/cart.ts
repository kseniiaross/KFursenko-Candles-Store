import api from "./axiosInstance";
import type { CartLine } from "../store/cartSlice";

type CartApiItem = {
  item_id: number | string;
  variant_id: number | string;
  candle_id: number | string;
  name: string;
  slug: string;
  image?: string | null;
  price: string | number;
  size: string;
  quantity: number | string;
  in_stock: boolean;
  is_gift: boolean;
};

type CartApiResponse = {
  id: number;
  items: CartApiItem[];
  created_at: string;
  updated_at: string;
};

export type AddToCartPayload = {
  variant_id: number;
  quantity: number;
  is_gift?: boolean;
};

export type UpdateCartItemPayload = {
  quantity?: number;
  is_gift?: boolean;
};

export type MergeCartPayload = {
  items: Array<{
    variant_id: number;
    quantity: number;
    is_gift?: boolean;
  }>;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapCartItem(item: CartApiItem): CartLine {
  return {
    item_id: toNumber(item.item_id),
    variant_id: toNumber(item.variant_id),
    candle_id: toNumber(item.candle_id),
    name: item.name,
    price: toNumber(item.price),
    image: item.image ?? undefined,
    size: item.size,
    quantity: Math.max(1, toNumber(item.quantity) || 1),
    isGift: Boolean(item.is_gift),
  };
}

export function mapCartResponse(data: CartApiResponse): CartLine[] {
  if (!data || !Array.isArray(data.items)) {
    return [];
  }

  return data.items
    .map(mapCartItem)
    .filter((item) => item.item_id && item.variant_id && item.candle_id);
}

export async function getMyCart(): Promise<CartLine[]> {
  const response = await api.get<CartApiResponse>("/cart/my/");
  return mapCartResponse(response.data);
}

export async function addToCart(payload: AddToCartPayload): Promise<CartLine[]> {
  const response = await api.post<CartApiResponse>("/cart/items/add/", {
    variant_id: Number(payload.variant_id),
    quantity: Math.max(1, Number(payload.quantity) || 1),
    is_gift: Boolean(payload.is_gift),
  });

  return mapCartResponse(response.data);
}

export async function patchCartItem(
  itemId: number,
  payload: UpdateCartItemPayload
): Promise<CartLine[]> {
  const response = await api.patch<CartApiResponse>(
    `/cart/items/${Number(itemId)}/`,
    payload
  );

  return mapCartResponse(response.data);
}

export async function deleteCartItem(itemId: number): Promise<CartLine[]> {
  const response = await api.delete<CartApiResponse>(
    `/cart/items/${Number(itemId)}/delete/`
  );

  return mapCartResponse(response.data);
}

export async function mergeCart(payload: MergeCartPayload): Promise<CartLine[]> {
  const response = await api.post<CartApiResponse>("/cart/merge/", {
    items: payload.items.map((item) => ({
      variant_id: Number(item.variant_id),
      quantity: Math.max(1, Number(item.quantity) || 1),
      is_gift: Boolean(item.is_gift),
    })),
  });

  return mapCartResponse(response.data);
}