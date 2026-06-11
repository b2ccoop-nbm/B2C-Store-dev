/** Bottom navigation tabs — UX-ARCHITECTURE.md */
export const BOTTOM_NAV = [
  { id: "home", label: "Home", href: "/" },
  { id: "search", label: "Search", href: "/search" },
  { id: "cart", label: "Cart", href: "/cart" },
  { id: "messages", label: "Messages", href: "/messages" },
  { id: "you", label: "You", href: "/profile" },
] as const;

export type BottomNavId = (typeof BOTTOM_NAV)[number]["id"];

export const STORAGE_KEYS = {
  persona: "b2ccoop_persona",
  welcomeSeen: "b2ccoop_welcome_seen",
  recentSearches: "b2ccoop_recent_searches",
  firstCartAdd: "b2ccoop_first_cart_add",
} as const;

export const TRUST_COPY = {
  coopName: "B2C Consumers Cooperative",
  helpPhone: "+63 32 000 0000",
  pickupLocation: "Coop store counter — main branch",
  registration: "CDA-registered consumers cooperative",
} as const;
