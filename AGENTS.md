# AGENTS.md

Static site for **Milkarf** (milkarf.com) — a Spanish-language pet-food storefront that takes orders by WhatsApp. No build step, no framework, no npm, no tests, no linter.

## Stack & layout
- Pure HTML/CSS/JS. Live files: `index.html` (customer storefront, ~2000 lines), `admin.html` (admin panel), `app.js` (~8400 lines, the entire app), `styles.css`, `firestore.rules`.
- No lint/build test runner. There IS a standalone test script: `node tests/plan-tests.mjs` (extracts `window.computePlanPricing`/`buildFeedingPlan`/`getWhatsAppTemplate` real source and validates presented bag math, discounts, plan switching and the WhatsApp message). Run it after touching plan/checkout logic.
- Tailwind via CDN (`tailwind.config` with brand colors purple/green/pink is inline in the HTML), Firebase JS SDK v11.6.1 as ES modules imported from `https://www.gstatic.com/firebasejs/...` inside `app.js`, `html2canvas` via CDN.
- `app.js` is a single ES module loaded by BOTH `index.html` and `admin.html`. All shared state/handlers are attached to `window.*` and UI calls them via inline `onclick`. Changes to `app.js` affect both pages.
- All UI copy, comments, and git commits are in **Spanish**.

## Run locally
- ES modules + CDN Tailwind break on `file://` — serve statically. VS Code Live Server is configured on port **5501** (`.vscode/settings.json`). `firestore.rules` unless testing is skipped: there is no local emulator setup; manual testing only.

## Deploy
- Push to `main` → GitHub Pages (CNAME `milkarf.com`, `.nojekyll`, no CI workflows). Commits like "Trigger deployment retry" are just pushes to re-trigger Pages.
- `mantenimiento` branch holds a separate maintenance-page variant (own `index.html`); do not merge it into `main`.

## Firestore (`firestore.rules`)
- Rules guard TWO mirrored namespaces and must be kept in sync: legacy top-level collections (`usuarios`, `pedidos`, `canjes`, `config`, `admins`, `beneficiosCanje`, `catalogoCanjes`, `recompensas`, `puntos_ajustes`) and the `/artifacts/{appId}/...` equivalents.
- `app.js` selects the namespace from the injected `__firebase_config` / `__app_id` globals; nothing currently defines them, so the legacy top-level paths are the live ones. Keep the `artifacts/{appId}` rules in lockstep anyway.
- Admin check = email allowlist (`ADMIN_EMAILS` in `app.js` matches the hardcoded list in the rules) OR existence of `admins/{email}` doc.
- Rules forbid clients from setting admin/points/level fields and force new orders to start as `en_proceso` — preserve these invariants.

## Product & config gotchas
- WhatsApp number and fallback pricing/plans live in `app.js` constants: `WA_NUMBER`, `MILKARF_CONFIG` (catalog, `planDiscounts`, `welcomeDiscountPct`), `PRICES_POLLO`/`PRICES_RES`.
- Firestore doc `config/tienda` can override prices/redeem items at runtime (`loadDynamicStoreConfig`) — static constants are the fallback.
- Orders/canjes write Firestore AND open WhatsApp; delivery notes are rendered to an image via html2canvas. There is no payment backend.
- Images: optimized fallback is `images/Gemini_Generated_Image_18qpp218qpp218qp.webp` (produced by `convert_images.py` from the ~9.5MB PNG). The stray `assets:images:` directory is an accidental artifact (colon in dir name) not referenced anywhere — safe to delete; don't add new large PNGs to the repo root.