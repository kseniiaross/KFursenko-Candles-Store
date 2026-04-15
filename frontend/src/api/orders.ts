import api from "../api/axiosInstance";
import type { Order } from "../types/orders";

export type CreateOrderPayload = {
  items: Array<{ candle_id: number; quantity: number }>;
};

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const resp = await api.post<Order>("/orders/", payload);
  return resp.data;
}

export async function createOrderFromCart(): Promise<Order> {
  const resp = await api.post<Order>("/orders/from-cart/", {});
  return resp.data;
}

export async function listMyOrders(): Promise<Order[]> {
  const resp = await api.get<Order[]>("/orders/my/");
  return resp.data;
}

export async function getMyOrderById(id: number): Promise<Order> {
  const resp = await api.get<Order>(`/orders/${id}/`);
  return resp.data;
}

export async function listStaffOrders(): Promise<Order[]> {
  const resp = await api.get<Order[]>("/orders/staff/");
  return resp.data;
}

export async function staffUpdateOrderStatus(id: number, statusValue: string): Promise<Order> {
  const resp = await api.patch<Order>(`/orders/${id}/status/`, { status: statusValue });
  return resp.data;
}