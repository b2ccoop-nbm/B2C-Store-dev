const CART_KEY = "b2ccoop_store_cart";

/** @typedef {{ sku: string; name: string; unitPrice: string; patronagePerUnit: string; vendorCode: string; quantity: number }} CartLine */

export function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeCart(/** @type {CartLine[]} */ lines) {
  localStorage.setItem(CART_KEY, JSON.stringify(lines));
}

export function addToCart(item) {
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

export function updateQty(sku, quantity) {
  const cart = readCart()
    .map((l) => (l.sku === sku ? { ...l, quantity } : l))
    .filter((l) => l.quantity > 0);
  writeCart(cart);
  return cart;
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
}

export function cartTotals(cart) {
  const gross = cart.reduce((s, l) => s + Number(l.unitPrice) * l.quantity, 0);
  const patronage = cart.reduce((s, l) => s + Number(l.patronagePerUnit) * l.quantity, 0);
  return { gross, patronage, count: cart.reduce((s, l) => s + l.quantity, 0) };
}

export function formatPhp(n) {
  return `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
