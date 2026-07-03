# Aerune Commerce Core V2

A single shared business engine for:

- **Customer website** — `index.html`
- **Private Control Booth** — `admin.html`
- **Staff POS / billing** — `pos.html`

The catalog is one source of truth. Add or edit a product in Control Booth, change its stock at the POS, or accept an online order: after Cloud Setup, the change appears everywhere.

## What is already built

- Premium cinematic customer storefront with collection landing, cart, checkout, product details, stock labels, and optional hero image/video.
- Private Control Booth for products, collections, individual storefronts, orders, publishing, images, stock, and product placement.
- POS billing screen with barcode/SKU search, stock adjustment, payment choice, receipt printing, and checkout.
- Multiple independently controlled customer storefronts. Every storefront has its own name, domain field, hero copy, hero media, visual mode, collections, product visibility, and catalog placement.
- Shared product stock across customer website(s) and POS.
- Product removal, collection removal, storefront removal, draft/published controls, image upload, and optional per-website price overrides.
- Smart product codes: no fixed `BAG-1001` placeholder. Every item has a separate editable **SKU** plus **barcode / scanner code**. Use **Generate** to create fresh internal codes, or type a real manufacturer barcode.

## Important: demo mode versus live cloud mode

The download opens in **Demo mode** first. It is safe to explore, but it only saves data inside one browser on one device.

For real remote editing and shared live stock across your phone, shop POS, customer websites, and home computer, complete **Cloud Setup** below. GitHub Pages hosts the front-end; the included Supabase database becomes the shared data layer.

## First five minutes — try it locally

1. Open `index.html` in Chrome or Edge to see the customer website.
2. Open `admin.html` to use the Control Booth.
3. Open `pos.html` for staff billing.
4. In `admin.html`, go to **Products** → **Add product**.
5. Choose the storefront and collection where customers should see the product. The customer website updates in the same browser automatically in Demo mode.

## Cloud Setup — turn it into one live system

### A. Create the shared Supabase project

1. Create a Supabase project.
2. Open **SQL Editor** and run all of `supabase/schema.sql` in one query.
3. In the Supabase project API settings, copy:
   - Project URL
   - **Publishable key** (or legacy `anon` key if that is what your project shows)
4. Open `config.js` and replace the two placeholder values.
5. Change:

```js
  demoMode: true,
```

to:

```js
  demoMode: false,
```

Do **not** use a `service_role` or secret key in `config.js`, GitHub, or a browser. The project’s database policies are designed for the public publishable/anon key.

### B. Make yourself the owner

1. Deploy the files or open `admin.html`.
2. Create your staff account with your email and password.
3. If Supabase asks for email confirmation, confirm it, then sign in once.
4. In Supabase SQL Editor, run this once, replacing the email and name:

```sql
update public.profiles
set role = 'owner', full_name = 'Your Name'
where id = (select id from auth.users where email = 'you@example.com');
```

Your next Control Booth sign-in has owner-level access. New accounts start as **cashier**. Promote trusted people to `manager` or `owner` through SQL until a visual staff-management page is added.

### C. Test shared inventory

1. Sign in to `admin.html` and add a product with `stock quantity = 5`.
2. Assign it to **Aerune** and a collection.
3. Open the customer page in another device or browser.
4. Place a test COD order for quantity `1`.
5. The product stock should become `4` in Control Booth and POS. The order appears in **Orders**.

## Run it on GitHub Pages

1. Create a **new repository** for this project. Do not mix it into your old single-file POS repository.
2. Upload all files and folders inside `aerune-commerce-core-v2` so these are at repository root:

```text
index.html
admin.html
pos.html
config.js
assets/
supabase/
README.md
```

3. Repository → **Settings** → **Pages**.
4. Under **Build and deployment** choose:

```text
Source: Deploy from a branch
Branch: main
Folder: /(root)
```

5. Save, wait for deployment, then open your Pages URL.

After Cloud Setup, you can sign in to `admin.html` from anywhere and make catalog changes remotely. Customer pages read the same database and update in real time.

## Multiple separate websites, one Control Booth

Create a storefront in **Control Booth → Storefronts** for each customer-facing brand or site:

```text
Aerune                 → bags / outdoor
The Work Room           → mixed retail goods
Pickles by [your name]  → food / pickles
Rainwear                → Terrain, Storm Guard, Cloud Shell
```

Each storefront can have its own:

- Name and logo initials
- Custom domain field
- Hero title, copy, image, or video
- Visual mode: Alpine technical, Editorial luxury, or Noir limited edition
- Collection folders
- Product visibility, position, and optional price override
- Publishing status

But all websites can use the same central products and stock.

### Preview a storefront while using one project

```text
index.html?site=aerune
index.html?site=the-work-room
```

### Put a storefront on its own domain later

Deploy the same project to that domain, or deploy a copy of the customer storefront files. In Control Booth, set that storefront’s **Custom domain** exactly to the hostname, for example:

```text
aerune.com
shop.aerune.com
```

The storefront automatically selects the correct brand based on the domain while still using the same Supabase project and shared catalog.

## Product codes and barcode scanner workflow

- **SKU / internal item code:** readable label such as `AE-ALT-0001`.
- **Barcode / scanner code:** numeric internal scanner code. Use a real manufacturer barcode whenever one exists.
- The automatic generator never locks new products into `BAG-1001`.
- You can type over either field at any time.
- POS search checks product title, SKU, barcode, and tags. A USB/Bluetooth scanner that types the code like a keyboard can search it directly.

## Checkout scope in this version

The customer site supports product browsing, cart, delivery details, COD, and QR payment confirmation. Orders are saved to the Control Booth and deduct stock using a secure database function.

Live online card payments, delivery-company APIs, VAT/PAN e-billing, fiscal receipt printers, accounting, and age/permit compliance for alcohol require separate Nepal-specific implementation and validation before real use.

## Safety checklist before real selling

- Keep your Supabase project password and owner access private.
- Do not add secret/service keys to the public GitHub repository.
- Take test orders before sharing the website.
- Check price, order numbering, courier, tax, refund, alcohol-license, age-verification, and invoice requirements with your accountant and relevant local authority.
- Use real product photos and product-copy review before opening the store.
