/** Category chip labels and icons for home / search shortcuts */
export const CATEGORY_SHORTCUTS = [
  { slug: "groceries", label: "Groceries", icon: "🛒" },
  { slug: "produce", label: "Produce", icon: "🥬" },
  { slug: "dairy", label: "Dairy", icon: "🥛" },
  { slug: "pantry", label: "Pantry", icon: "🍚" },
  { slug: "household", label: "Household", icon: "🏠" },
  { slug: "products", label: "All products", icon: "✨" },
] as const;

export function categoryIcon(category: string): string {
  const slug = category.trim().toLowerCase().replace(/\s+/g, "-");
  const found = CATEGORY_SHORTCUTS.find((c) => c.slug === slug);
  return found?.icon ?? "📦";
}
