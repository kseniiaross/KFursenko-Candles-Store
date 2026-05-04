export interface CollectionParent {
  id: number;
  name: string;
  slug: string;
}

export interface CollectionChild {
  id: number;
  name: string;
  slug: string;
}

export interface Collection {
  id: number;
  name: string;
  slug: string;
  is_group?: boolean;
  parent?: CollectionParent | null;
  children?: CollectionChild[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export type BadgeKind =
  | "new_shopper"
  | "loyalty"
  | "b1g2"
  | "holiday"
  | "discount"
  | "discounted_candles"
  | string;

export interface CandleBadge {
  slug: string;
  badge_text: string;
  kind: BadgeKind;
  discount_percent?: number | null;
  priority?: number;
}

export interface CandleImage {
  id: number;
  image: string;
  sort_order: number;
}

export interface CandleVariant {
  id: number;
  size: string;
  price: string;
  stock_qty: number;
  is_active: boolean;
}

export interface Candle {
  id: number;
  name: string;
  slug: string;
  description: string;

  name_en?: string;
  name_ru?: string;
  name_es?: string;
  name_fr?: string;

  description_en?: string;
  description_ru?: string;
  description_es?: string;
  description_fr?: string;

  fragrance_family?: string;
  intensity?: string;

  top_notes?: string[];
  heart_notes?: string[];
  base_notes?: string[];
  mood_tags?: string[];
  use_case_tags?: string[];
  ideal_spaces?: string[];
  season_tags?: string[];

  image: string | null;
  images?: CandleImage[];

  price?: string | null;
  discount_price?: number | string | null;

  stock_qty?: number;
  in_stock?: boolean;

  is_sold_out: boolean;
  is_bestseller: boolean;

  created_at: string;

  category?: Category;
  collections: Collection[];

  badges?: CandleBadge[];
  variants?: CandleVariant[];
}

export function getLowestActiveVariant(candle: Candle): CandleVariant | null {
  const activeVariants = candle.variants?.filter(
    (variant) => variant.is_active && Number(variant.price) > 0,
  );

  if (!activeVariants || activeVariants.length === 0) {
    return null;
  }

  return [...activeVariants].sort(
    (a, b) => Number(a.price) - Number(b.price),
  )[0];
}

export function getDisplayPrice(candle: Candle): string {
  const lowestVariant = getLowestActiveVariant(candle);

  if (lowestVariant) {
    return lowestVariant.price;
  }

  if (candle.price) {
    return String(candle.price);
  }

  return "";
}

export function isCandleAvailable(candle: Candle): boolean {
  if (candle.is_sold_out) return false;

  const activeVariants = candle.variants?.filter((variant) => variant.is_active);

  if (activeVariants && activeVariants.length > 0) {
    return activeVariants.some((variant) => variant.stock_qty > 0);
  }

  return Boolean(candle.in_stock || (candle.stock_qty ?? 0) > 0);
}