# Product photos (MVP)

One JPEG/PNG/WebP per listing (max 2 MB), stored in **Cloudflare R2**.

## Merchant flow

1. Go to **Sell → New listing** (`/sell/new`) to add a photo when creating a listing, **or**
2. Go to **Sell → Your listings** (`/sell/listings`), click **Load listings**, then **Add photo** / **Change photo** on any row.
3. JPEG, PNG, or WebP — max 2 MB. Live listings show the new photo on the storefront right away (no re-approval).

## One-time Cloudflare setup

1. **Enable R2** in the Cloudflare dashboard (Account → R2).
2. Create bucket: `b2ccoop` (or set `R2_BUCKET` when running setup)
3. Set `PUBLIC_IMAGES_BASE_URL` on the API Worker (served via `GET /media/products/...`, not `r2.dev` — avoids DNS issues on some networks).

## Database

Migration `0006_product_image.sql` adds `products.image_url`:

```bash
cd B2C-Store/apps/api
DATABASE_URL='<neon b2ccoop_store url>' npm run db:migrate
```

Or run in Neon SQL editor:

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url varchar(512);
```

## API

- `POST /merchant/listings/:sku/image` — multipart field `image` (merchant bearer token)
