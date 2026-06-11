/**
 * Dev catalog — keep pricing splits aligned with B2C-Accounting marketplace-sale posts.
 * @see B2C-PMES/backend/src/store/store-catalog.ts
 */

export type SeedVendor = {
  code: string;
  slug: string;
  name: string;
  email: string;
  description?: string;
};

export type SeedProduct = {
  vendorCode: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: string;
  salesPerUnit: string;
  vendorPayablePerUnit: string;
  cogsPerUnit: string;
  patronagePerUnit: string;
};

export const SEED_VENDORS: SeedVendor[] = [
  {
    code: "B2C-DEMO",
    slug: "b2c-demo-groceries",
    name: "B2C Demo Groceries",
    email: "groceries@b2ccoop.test",
    description: "Everyday staples and pantry goods from our demo grocer.",
  },
  {
    code: "B2C-FARM",
    slug: "b2c-farm-fresh",
    name: "B2C Farm Fresh Co-op",
    email: "farm@b2ccoop.test",
    description: "Seasonal produce and farm goods from member growers.",
  },
];

export const SEED_PRODUCTS: SeedProduct[] = [
  // B2C-DEMO — groceries (original PMES demo SKUs)
  {
    vendorCode: "B2C-DEMO",
    sku: "RICE-5KG",
    name: "Premium Rice 5kg",
    category: "Groceries",
    unitPrice: "350.00",
    salesPerUnit: "50.00",
    vendorPayablePerUnit: "300.00",
    cogsPerUnit: "300.00",
    patronagePerUnit: "5.00",
  },
  {
    vendorCode: "B2C-DEMO",
    sku: "OIL-1L",
    name: "Cooking Oil 1L",
    category: "Groceries",
    unitPrice: "120.00",
    salesPerUnit: "20.00",
    vendorPayablePerUnit: "100.00",
    cogsPerUnit: "100.00",
    patronagePerUnit: "2.00",
  },
  {
    vendorCode: "B2C-DEMO",
    sku: "SUGAR-1KG",
    name: "Brown Sugar 1kg",
    category: "Groceries",
    unitPrice: "85.00",
    salesPerUnit: "12.00",
    vendorPayablePerUnit: "73.00",
    cogsPerUnit: "73.00",
    patronagePerUnit: "1.50",
  },
  {
    vendorCode: "B2C-DEMO",
    sku: "NOODLES-5PK",
    name: "Instant Noodles (5-pack)",
    category: "Groceries",
    unitPrice: "65.00",
    salesPerUnit: "10.00",
    vendorPayablePerUnit: "55.00",
    cogsPerUnit: "55.00",
    patronagePerUnit: "1.00",
  },
  {
    vendorCode: "B2C-DEMO",
    sku: "MILK-1L",
    name: "Fresh Milk 1L",
    category: "Dairy",
    unitPrice: "95.00",
    salesPerUnit: "15.00",
    vendorPayablePerUnit: "80.00",
    cogsPerUnit: "80.00",
    patronagePerUnit: "1.50",
  },
  {
    vendorCode: "B2C-DEMO",
    sku: "SOAP-BAR",
    name: "Coop Bath Soap",
    category: "Household",
    unitPrice: "45.00",
    salesPerUnit: "8.00",
    vendorPayablePerUnit: "37.00",
    cogsPerUnit: "37.00",
    patronagePerUnit: "0.50",
  },
  {
    vendorCode: "B2C-DEMO",
    sku: "COFFEE-200G",
    name: "Coop Ground Coffee 200g",
    category: "Groceries",
    unitPrice: "180.00",
    salesPerUnit: "25.00",
    vendorPayablePerUnit: "155.00",
    cogsPerUnit: "155.00",
    patronagePerUnit: "2.50",
  },
  {
    vendorCode: "B2C-DEMO",
    sku: "DETERGENT-1KG",
    name: "Laundry Detergent 1kg",
    category: "Household",
    unitPrice: "110.00",
    salesPerUnit: "18.00",
    vendorPayablePerUnit: "92.00",
    cogsPerUnit: "92.00",
    patronagePerUnit: "1.25",
  },
  // B2C-FARM — produce
  {
    vendorCode: "B2C-FARM",
    sku: "EGGS-12",
    name: "Free-range Eggs (12)",
    category: "Produce",
    unitPrice: "140.00",
    salesPerUnit: "20.00",
    vendorPayablePerUnit: "120.00",
    cogsPerUnit: "120.00",
    patronagePerUnit: "2.00",
  },
  {
    vendorCode: "B2C-FARM",
    sku: "BANANA-1KG",
    name: "Saba Bananas 1kg",
    category: "Produce",
    unitPrice: "55.00",
    salesPerUnit: "8.00",
    vendorPayablePerUnit: "47.00",
    cogsPerUnit: "47.00",
    patronagePerUnit: "0.75",
  },
  {
    vendorCode: "B2C-FARM",
    sku: "TOMATO-1KG",
    name: "Fresh Tomatoes 1kg",
    category: "Produce",
    unitPrice: "70.00",
    salesPerUnit: "10.00",
    vendorPayablePerUnit: "60.00",
    cogsPerUnit: "60.00",
    patronagePerUnit: "1.00",
  },
  {
    vendorCode: "B2C-FARM",
    sku: "KANGKONG-BUN",
    name: "Kangkong Bundle",
    category: "Produce",
    unitPrice: "35.00",
    salesPerUnit: "5.00",
    vendorPayablePerUnit: "30.00",
    cogsPerUnit: "30.00",
    patronagePerUnit: "0.50",
  },
  {
    vendorCode: "B2C-FARM",
    sku: "HONEY-250ML",
    name: "Local Honey 250ml",
    category: "Pantry",
    unitPrice: "220.00",
    salesPerUnit: "30.00",
    vendorPayablePerUnit: "190.00",
    cogsPerUnit: "190.00",
    patronagePerUnit: "3.00",
  },
];

/** One-click demo cart (PMES smoke bundle). */
export const DEMO_CART_SKUS = [
  { sku: "RICE-5KG", quantity: 1 },
  { sku: "OIL-1L", quantity: 1 },
] as const;
