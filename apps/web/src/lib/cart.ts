export const CART_KEY = "b2ccoop_store_cart";

export type CartLine = {
  sku: string;
  name: string;
  unitPrice: string;
  patronagePerUnit: string;
  vendorCode: string;
  quantity: number;
};

export function readCart(): CartLine[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(lines));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cart-updated"));
  }
}

export function addToCart(item: Omit<CartLine, "quantity">): CartLine[] {
  const cart = readCart();
  const existing = cart.find((l) => l.sku === item.sku);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }
  writeCart(cart);
  return cart;
}

export function updateQty(sku: string, quantity: number): CartLine[] {
  const cart = readCart()
    .map((l) => (l.sku === sku ? { ...l, quantity } : l))
    .filter((l) => l.quantity > 0);
  writeCart(cart);
  return cart;
}

export function clearCart(): void {
  localStorage.removeItem(CART_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cart-updated"));
  }
}

export function cartTotals(cart: CartLine[]) {
  const gross = cart.reduce((s, l) => s + Number(l.unitPrice) * l.quantity, 0);
  const count = cart.reduce((s, l) => s + l.quantity, 0);
  return { gross, count };
}
