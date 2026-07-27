import { LISTING_CATEGORIES } from "@b2ccoop/store-shared";

/** Category chip labels and icons for home / search shortcuts */
export const CATEGORY_SHORTCUTS = [
  { slug: "groceries", label: "Groceries", icon: "🛒" },
  { slug: "produce", label: "Produce", icon: "🥬" },
  { slug: "dairy", label: "Dairy", icon: "🥛" },
  { slug: "personal-care", label: "Personal Care", icon: "🧴" },
  { slug: "coffee-and-tea", label: "Coffee and Tea", icon: "☕" },
  { slug: "health-supplements", label: "Health Supplements", icon: "💊" },
  { slug: "household", label: "Household", icon: "🏠" },
  { slug: "products", label: "All products", icon: "✨" },
] as const;

const CATEGORY_ICONS: Record<string, string> = {
  Groceries: "🛒",
  Produce: "🥬",
  Dairy: "🥛",
  Bakery: "🥖",
  "Fish and Other Seafood": "🐟",
  "Meat and Poultry": "🍗",
  "Other Food Products": "🍱",
  "Coffee and Tea": "☕",
  Health: "💚",
  "Personal Care": "🧴",
  "Skin Care": "✨",
  "Health Drinks": "🥤",
  "Health Supplements": "💊",
  "Other Health Products": "🩺",
  Household: "🏠",
  "Small Home Appliances": "🔌",
  "Mobile Phones, Tablets etc.": "📱",
  "Computers and Accessories": "💻",
  "Other Electrical and Electronic Products": "⚡",
  "School and Office Supplies": "📎",
  General: "📦",
};

for (const label of LISTING_CATEGORIES) {
  if (!CATEGORY_ICONS[label]) {
    CATEGORY_ICONS[label] = "📦";
  }
}

export function categoryIcon(category: string): string {
  const exact = CATEGORY_ICONS[category.trim()];
  if (exact) return exact;

  const slug = category.trim().toLowerCase().replace(/\s+/g, "-");
  const found = CATEGORY_SHORTCUTS.find((c) => c.slug === slug);
  return found?.icon ?? "📦";
}
