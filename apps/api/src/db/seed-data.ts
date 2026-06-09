/**
 * Demo catalog seed — aligned with B2C-PMES/backend/src/store/store-catalog.ts
 */
export const SEED_VENDOR = {
  code: "B2C-DEMO",
  name: "B2C Demo Vendor",
  email: "vendor@b2ccoop.com",
} as const;

export const SEED_PRODUCTS = [
  {
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
    sku: "SOAP-BAR",
    name: "Coop Bath Soap",
    category: "Household",
    unitPrice: "45.00",
    salesPerUnit: "8.00",
    vendorPayablePerUnit: "37.00",
    cogsPerUnit: "37.00",
    patronagePerUnit: "0.50",
  },
] as const;
