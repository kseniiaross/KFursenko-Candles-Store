import api from "./axiosInstance";
import type { CartLine } from "../store/cartSlice";

type CartApiItem = {
  item_id: number;
  variant_id: number;
  candle_id: number;
  name: string;
  slug: string;
  image?: string | null;
  price: string;
  size: string;
  quantity: number;
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

function mapCartItem(item: CartApiItem): CartLine {
  return {
    item_id: item.item_id,
    variant_id: item.variant_id,
    candle_id: item.candle_id,
    name: item.name,
    price: Number(item.price) || 0,
    image: item.image ?? undefined,
    size: item.size,
    quantity: item.quantity,
    isGift: item.is_gift,
  };
}

export function mapCartResponse(data: CartApiResponse): CartLine[] {
  return Array.isArray(data.items) ? data.items.map(mapCartItem) : [];
}

export async function getMyCart(): Promise<CartLine[]> {
  const resp = await api.get<CartApiResponse>("/cart/my/");
  return mapCartResponse(resp.data);
}

export async function addToCart(payload: AddToCartPayload): Promise<CartLine[]> {
  const resp = await api.post<CartApiResponse>("/cart/items/add/", payload);
  return mapCartResponse(resp.data);
}

export async function patchCartItem(
  itemId: number,
  payload: UpdateCartItemPayload
): Promise<CartLine[]> {
  const resp = await api.patch<CartApiResponse>(`/cart/items/${itemId}/`, payload);
  return mapCartResponse(resp.data);
}

export async function deleteCartItem(itemId: number): Promise<CartLine[]> {
  const resp = await api.delete<CartApiResponse>(`/cart/items/${itemId}/delete/`);
  return mapCartResponse(resp.data);
}

export async function mergeCart(payload: MergeCartPayload): Promise<CartLine[]> {
  const resp = await api.post<CartApiResponse>("/cart/merge/", payload);
  return mapCartResponse(resp.data);
}