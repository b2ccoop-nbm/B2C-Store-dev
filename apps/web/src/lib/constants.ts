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
} as const;
