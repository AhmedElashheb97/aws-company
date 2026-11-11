# AWS COMPANY — car import office app

Read this whole file before doing anything. It is the shared memory between every Claude session
on every computer. The user works from more than one computer; this file + git is how they stay in sync.

## Sync workflow (mandatory, every session)

1. **Start:** a SessionStart hook runs `git pull` automatically. If it reported a conflict or failed,
   run `git pull --rebase` yourself and resolve before editing anything.
2. **After every change the user asked for:**
   - add a dated line at the top of **"Change log"** at the bottom of this file
     (what changed, why, anything left undone),
   - update any section above that the change made out of date,
   - `git add -A && git commit -m "..." && git push` — Vercel deploys from `main` automatically.
3. Never leave work uncommitted at the end of a turn — the other computer won't see it.

## The user

- Ahmed, runs a car import office (US auctions → Libya, port Al-Khoms). Writes in **Libyan Arabic**;
  answer in Libyan Arabic, short and clear.
- Wants to **see accounting changes before they are published** ("خلي نشوف قبل") — for money/profit
  logic, build it, show it locally, and push only after he says so. UI/visual tweaks can go straight out.
- Never type passwords or credentials for him. He signs in himself (GitHub, Vercel, Firebase, app login).

## Stack & where things live

- One static file: `index.html` (vanilla JS, RTL Arabic, font **Tajawal** from Google Fonts,
  orange theme, side menu on desktop / bottom tab bar on phones). Plus `firebase-config.js`,
  `ports-data.js` (ports, yards, ocean & towing prices from Atlantic Express), `logo.png`, `favicon.png`, `icon-180.png`.
- **GitHub:** `AhmedElashheb97/aws-company` (private), branch `main`.
- **Live site:** https://aws-company.vercel.app (Vercel project `aws-company`, team `ahmed-7513`,
  auto-deploys on push). Vercel sometimes misses a push — if the new code isn't live after ~1 min,
  push an empty commit (`git commit --allow-empty -m Redeploy && git push`).
- **Local preview:** `.claude/launch.json` → `serve.ps1` on port 8766 (local only, gitignored).
- **Firebase project `aws-company`** (Firestore + Auth email/password, compat SDK 10.12.2).
  Collections: `cars`, `customers`, `containers`, `meta/settings`, `log`, `tracking`.
- **Firestore rules** = `firestore.rules` in the repo. Publishing needs the Firebase console
  (Firestore → Rules → Publish). Current rules: signed-in users read/write cars, customers, meta,
  containers; `tracking/{VIN}` is public `get` only; `log` is append-only (create with `by == auth email`,
  no update/delete). Any new collection needs a rule added AND published.
- **Old system:** Firebase project `aws-cars` (repo `AhmedElashheb97/aws-cars`, source copy at
  `C:\Users\AEMAA\Desktop\Index.html` on the first PC). Data was imported from it (Settings → استيراد من AWS-CARS).

## Money engine (`calc(c)` / `sync(c)` in index.html)

- **Stage 1 (buy):** required = buyPrice + auctionFees + officeFee + wire (wirePct, default 1.5% of price+fees)
  + customer expenses of stage `buy`. Profit1 = officeFee + wire − office expenses of stage `buy`.
- **Stage 2 (ship):** required = towCharge + oceanCharge + customer expenses `ship` + optional shipWirePct.
  Profit2 = charges + wire2 − actual (towCost + oceanCost) − office expenses `ship`.
- Ocean per car = container price (ports-data, for 2/3/4 cars) ÷ cars + $25 markup; tow = yard price + $25.
- `sync`: stage locks (`lock1`/`lock2`) when its remainder hits 0; profit counts as "received" in the lock month.
- Expenses: `{id, desc, amount, stage:'buy'|'ship', payer:'customer'|'office', kind:'expense'|'fine', date, onInv?, payCost?, reloc?}`.
  Customer expenses are pass-through (not profit). Office expenses reduce profit; `onInv` shows them on the
  invoice as "على حساب المكتب" without charging.
- Auction payment cost (card/PayPal/FX loss) must be recorded as an office stage-1 expense — the app asks for it
  in "تم السداد للمزاد" and warns "⚠ تكلفة الدفع ناقصة" when missing.
- `advance` = auction paid by office and stage 1 not locked → "سلف المكتب للمزاد" (click card → list).

## Features (high level)

Cars list & page, customers (balances per stage), profits, ports map, **containers** (group by export port,
pick any cars from any port, shipping company Atlantic Express / MTL, real cost split, shortfall warning,
container stage moves all its cars), extra charges box in the car form (relocation to another port, FedEx $45,
storage, other), customer **tracking page** (`/?vin=…` or `/#track`, synced to `tracking/{VIN}`, no costs/profit shown),
WhatsApp tracking link, **change log** (who/when/old→new, per car & container), old-system importer, logo.

## Known open issues (from the accounting review — not fixed yet, user decides)

3. Lock date = save day (`today()`), not the date of the payment that completed the stage.
4. A late customer charge after a lock reopens the stage and moves its profit to another month.
5. Overpayments created after the fact (editing/removing expenses) show as negative remainder, not "راجع له".
6. Stage-2 profit uses price-list costs until a real container cost is entered.
7. If the customer paid the auction himself, the 1.5% wire is still charged.
8. No record of payments to the shipping company → can't reconcile with cash on hand.

## Testing rules

- Don't write test data into the live Firestore. Test with in-memory data: stub `save`, `saveContainer`,
  `addLog` in the page, then reload to discard.
- Check both desktop (1280px) and phone (375px) widths for UI changes.

## Change log (newest first)

- 2026-11-11 — Reverted commit 3948fa7 ("Update index.html", uploaded by Ahmed by hand on GitHub, removed ~1370 lines) at his request;
  `index.html` is back to the c0238c8 version. The reverted version is still in git history if he wants parts of it back.
- 2026-11-11 — Added this CLAUDE.md + SessionStart `git pull` hook so sessions on any computer stay in sync.
- 2026-11-10 — "سلف المكتب للمزاد" card is clickable → list of cars with outstanding auction advance.
- 2026-11-09 — Containers: pick any cars from any port, move between containers, shipping company (Atlantic Express, MTL).
- 2026-11-09 — Containers feature (2/3/4 buttons, grouping screen, containers page, cost split, warning); Tajawal font.
- 2026-11-09 — Change log (append-only in Firestore rules); auction payment-cost prompt + warning.
- 2026-11-08 — GitHub + Vercel deploy, tracking page, logo, side menu, extra charges box, per-stage balances, profit colors.
