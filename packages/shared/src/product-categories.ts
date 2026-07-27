/** Canonical product listing categories (merchant wizard + listings editor). */
export const LISTING_CATEGORIES = [
  "Groceries",
  "Produce",
  "Dairy",
  "Bakery",
  "Fish and Other Seafood",
  "Meat and Poultry",
  "Other Food Products",
  "Coffee and Tea",
  "Health",
  "Personal Care",
  "Skin Care",
  "Health Drinks",
  "Health Supplements",
  "Other Health Products",
  "Household",
  "Small Home Appliances",
  "Mobile Phones, Tablets etc.",
  "Computers and Accessories",
  "Other Electrical and Electronic Products",
  "School and Office Supplies",
  "General",
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const DEFAULT_LISTING_CATEGORY: ListingCategory = "Groceries";
