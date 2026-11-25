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
  orange accent on a light grey/white theme, floating top bar on desktop / bottom tab bar on phones;
  the cars page opens with a dark welcome banner + "يحتاج انتباهك" chips). The new look lives in the last block of the `<style>` tag
  ("look 2") and overrides the older rules above it — edit there for visual changes. Plus `firebase-config.js`,
  `ports-data.js` (ports, yards, ocean & towing prices from Atlantic Express), `logo.png`, `favicon.png`, `icon-180.png`.
- **GitHub:** `AhmedElashheb97/aws-company` (private), branch `main`.
- **Live site:** https://aws-company.vercel.app (Vercel project `aws-company`, team `ahmed-7513`,
  auto-deploys on push). Vercel sometimes misses a push — if the new code isn't live after ~1 min,
  push an empty commit (`git commit --allow-empty -m Redeploy && git push`).
- **Local preview:** `.claude/launch.json` → `serve.ps1` on port 8766 (local only, gitignored).
- **`api/fees.js`** = the only server-side code: a Vercel serverless function (`POST /api/fees`) that forwards fee quotes to
  `https://api.auctionfeescalculator.com`. Does not run under a plain static server — local testing needs a server that mounts it.
- **`api/img.js`** = Vercel function `GET /api/img?u=<https url>`: returns an auction photo with CORS so the invoice PDF can draw it
  (https only, host names only — no IPs/localhost, image responses only, ≤ 8 MB).
- **`vendor/html2pdf-0.10.1.bundle.min.js`** (MIT, bundled copy — CDNs are blocked in the cloud sessions) is loaded only when the
  invoice PDF is made.
- **Firebase project `aws-company`** (Firestore + Auth email/password, compat SDK 10.12.2).
  Collections: `cars`, `customers`, `containers`, `meta/settings`, `log`, `tracking`, `funds`, `fundMoves`, `debts`.
- **Firestore rules** = `firestore.rules` in the repo. Publishing needs the Firebase console
  (Firestore → Rules → Publish). Current rules: signed-in users read/write cars, customers, meta,
  containers; `tracking/{VIN}` is public `get` only; `log` is append-only (create with `by == auth email`,
  no update/delete). Any new collection needs a rule added AND published.
- **Old system:** Firebase project `aws-cars` (repo `AhmedElashheb97/aws-cars`, source copy at
  `C:\Users\AEMAA\Desktop\Index.html` on the first PC). Data was imported from it (Settings → استيراد من AWS-CARS).

## Daily backup to Google Drive

- `backup/drive-backup.gs` = Google Apps Script (not part of the web app). Ahmed pastes it into script.google.com under his own
  Google account, adds Script properties `BACKUP_EMAIL` / `BACKUP_PASSWORD` (an app login — he types them himself), runs `setup` once.
- Every day ~03:00 it signs in through the Firebase Auth REST API, reads `cars`, `customers`, `containers`, `log`, `meta/settings`
  through the Firestore REST API and writes `car-office-backup-YYYY-MM-DD.json` into the Drive folder "AWS COMPANY - نسخ احتياطية"
  (same shape as the app's "تصدير نسخة"). Backups older than 90 days go to the Drive trash; a failed run emails him.
- If the script in the repo changes, he has to paste the new version into script.google.com again — it does not update itself.
- Restore = Settings → "استيراد نسخة". That import (`replaceAll`) only restores cars, customers and settings — containers and the
  log are in the file but are NOT restored yet.

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

## How Ahmed works (facts he told us — don't re-ask)

- Customers always pay the office; the office pays the auction. No customer pays an auction directly.
- No office overheads: no rent, salaries, electricity or internet. So car profits ≈ his net profit; a cash book / chart of
  accounts was discussed (2026-11-19) and he does not need one for now. Revisit only if cash on hand stops matching.

## Known open issues (from the accounting review — not fixed yet, user decides)

3. Lock date = save day (`today()`), not the date of the payment that completed the stage.
4. A late customer charge after a lock reopens the stage and moves its profit to another month.
5. Overpayments created after the fact (editing/removing expenses) show as negative remainder, not "راجع له".
6. Stage-2 profit uses price-list costs until a real container cost is entered.
7. If the customer paid the auction himself, the 1.5% wire is still charged. — **not relevant in practice** (Ahmed, 2026-11-19: customers never pay the
   auction themselves; they give him the money and the office pays). Leave as is unless he says otherwise.
8. No record of payments to the shipping company → can't reconcile with cash on hand.

## Testing rules

- Don't write test data into the live Firestore. Test with in-memory data: stub `save`, `saveContainer`,
  `addLog` in the page, then reload to discard.
- Check both desktop (1280px) and phone (375px) widths for UI changes.

## Change log (newest first)

- 2026-11-25 — Published to main with Ahmed's OK ("انشر"): "الديون" = second tab on the treasuries page
  (tabs 👛 الخزائن / 🤝 الديون, `ui.fundTab`). People who are not customers: collection `debts`
  {id,name,phone,note,created,entries:[{id,type took|paid,amount,date,desc,at}]}; balance = Σtook − Σpaid (>0 we owe him, <0 he owes
  us). List with totals "إجمالي اللي علينا" / "لينا عند ناس", person page with running balance, ＋ أخذنا منه / − رجعناله, edit/delete;
  optional starting amount when adding a person. Not linked to treasuries or cars. Logged as kind 'debt'. Needs a new rule line
  `match /debts/{id}` published in Firebase (in `firestore.rules`) and the updated backup script pasted (it now backs up `debts`).
- 2026-11-24 — Published to main with Ahmed's OK ("انشر"): treasuries now hold PROFIT ONLY
  (Ahmed: "الخزائن تكون فيها مكاسب فقط — منحطش فلوس الزبائن"). Dark "مكسب ما توزّعش بعد" card on the treasuries page =
  received profit (locked stages, `profitRows`) from `db.settings.profitFrom` (month, '' = all; stored in meta/settings, selector on
  the card) − all moves of type `alloc`. "من وين؟" lists the locked stages behind it. "★ وزّع المكسب" window: an amount per treasury,
  total can't exceed the undistributed profit; each amount becomes a move `{type:'alloc', cat:'توزيع مكسب'}` that adds to the treasury.
  If a stage reopens after distributing, the pool goes negative with a warning. "↓ داخل" renamed "داخل آخر" (categories: دخل آخر /
  إيداع / أخرى — no more "دفعة من زبون"); "↑ طالع" categories: سحب شخصي / مصروف / استثمار / أخرى. Ahmed's first use: profit
  $1,568.09 → ماهر $693.09 + شمال افريقيا $875.
- 2026-11-24 — Published to main with Ahmed's OK ("انشر"; he said more changes to it are coming). "الخزائن" page (menu item, wallet icon).
  US dollars only and separate from the cars (Ahmed's choice: payments are NOT linked to a treasury). New collections `funds`
  {id,name,kind cash|bank|card|other,opening,openDate,note,created} and `fundMoves` {id,type in|out|transfer,fund,to?,amount,date,cat,desc,by,at};
  balance = opening + in − out ± transfers (`fundBalance`). Page: total of all treasuries, month in/out, one card per treasury
  (click = its moves with a running balance), buttons ↓ داخل / ↑ طالع / ⇄ تحويل, edit/delete moves; a treasury with moves can't be
  deleted. Changes go to the change log (kind 'fund'). `firestore.rules` gains funds + fundMoves (Ahmed must publish them in the
  Firebase console BEFORE using the page live, or saves fail); `backup/drive-backup.gs` now also backs them up (he must paste the
  new script into script.google.com). "استيراد نسخة" does not restore them. Also: top menu is icons-only between 901–1240px and the
  tracking link is icon-only on desktop (8 links didn't fit beside "سيارة جديدة").
- 2026-11-20 — Invoice PDF on phones: Ahmed shared the downloaded PDF to WhatsApp from iPhone and it arrived with an extra
  "blob:https://aws-company.vercel.app/…" text (and the message failed). Now the PDF is built as a File (`outputPdf('blob')`) and
  `pdfReady` shows a "الفاتورة جاهزة" window with "📤 إرسال (واتساب…)" → `navigator.share({files:[file]})` (file only, no text/url;
  needs a fresh tap, hence the window) and "⬇ حفظ". If sharing is refused it saves the file instead. Computers (or browsers that
  can't share files) download directly. Tested with a mocked share sheet only — not yet on a real iPhone.
- 2026-11-20 — Invoice button now opens a small window first (`invoiceAsk`): choose المرحلة الأولى / المرحلة الثانية / المرحلتين
  (default: stage 1 while the car is in stage 1, else both). `invoiceHtml(c, img, st)` shows only the chosen stage(s) and their
  payments; a stage whose remainder is 0 gets a green "خالص ✓" stamp and its "الباقي" row reads "✓ خالص" (overpaid → "زيادة مدفوعة $X");
  if every shown stage is paid the bottom line is "✓ خالص — ما عليك شي". File name gets "شراء"/"شحن" for a single stage. Display only.
- 2026-11-19 — "🧾 فاتورة الزبون (PDF)" on the car page now downloads the invoice as an A4 PDF (`invoicePdf`) instead of opening
  the print dialog. Same content as before (`invoiceHtml(c, img)` is shared with `printInvoice`, which is now only the fallback if
  the PDF fails). Car photo goes through `/api/img`. Arabic fix for html2canvas: each word is wrapped in its own span and Arabic words
  are drawn right-to-left (`rtlCanvasText`), else words run together. Stage headings in the invoice now read "المرحلة الأولى: الشراء" /
  "المرحلة الثانية: الشحن" (a digit next to a colon came out jumbled in the PDF). File name: "فاتورة <customer> <car> <last 6 of VIN>.pdf".
  Text in the PDF is an image (not selectable). Visual only — money logic untouched.
- 2026-11-19 — Proposed chart of accounts for Ahmed, in English: `docs/chart-of-accounts.pdf` (source `docs/chart-of-accounts.html`).
  Groups 1 Assets / 2 Liabilities / 3 Equity / 4 Revenue / 5 Expenses, each account mapped to the app. Proposal only — nothing built.
  If built, suggested first step: 11 Cash accounts, 21 Payable to shipping companies, 32 Owner's drawings.
- 2026-11-19 — Customer invoice (`printInvoice`) now shows the car's main photo (`c.img`) beside the customer/car details. Printing
  waits up to 5s for the photo to load; a photo that fails to load is left out. Cars without a photo print as before. Visual only.
- 2026-11-19 — Phone layout pass (Ahmed: "not clear on the phone"). Last `<style>` block "phones: fit the screen": at ≤640px any
  table wider than the screen becomes one card per row (`tblCards()` runs after every `render()`/`openModal`, copies header text into
  `data-l` and adds `.tcard` only when the table overflows — small tables stay tables). Forms/windows open as a bottom sheet with a
  sticky title and sticky save/cancel; inputs 16px (no iOS zoom). Car form: the customer field used inline `grid-column:span 2`, which
  created a hidden 2nd column on phones and squeezed every field — now class `.span2`, full width on phones; `.grid > *{min-width:0}`.
  Also: button groups in a 2-column grid, banner chips scroll sideways, KPI icons hidden on phones. Desktop/tablet unchanged. Visual only.
- 2026-11-18 — Yard field in the car form now accepts names the way the auction page writes them ("Phoenix (AZ)", "Phoenix, AZ",
  "phoenix", "Tucson AZ") via `findYard(text, auction)`; the form's auction (Copart/IAAI) picks between same-name yards, else the hint
  lists the choices. On a match the field is rewritten to the full list label. Ahmed couldn't find IAAI Phoenix because only the exact
  label "Phoenix, AZ — IAAI" was accepted. Price list itself unchanged.
- 2026-11-12 — Built-in auction fees calculator (Ahmed did not want a link to the outside site). "🧮 حاسبة رسوم المزاد" on the cars
  toolbar opens a window; "🧮 احسبها" beside "رسوم المزاد" in the car form opens the same calculator inline, prefilled with the buy
  price and auction, with a button that copies the fee into the field (never automatic). Numbers come from the free, keyless API of
  auctionfeescalculator.com (docs: docs.auctionfeescalculator.com) through our own Vercel function `api/fees.js` (their API has no CORS
  headers, so the browser cannot call it directly). Only bid amount + options are sent. Options are remembered in localStorage
  (`aws_fee_calc_v1`). Their towing-to-port estimate is NOT used. `calc`/`sync` untouched.
- 2026-11-12 — Drive backup is installed and running: Ahmed ran `setup` in his Apps Script project; first real backup wrote
  `car-office-backup-2026-11-12.json` (15 cars, 3 customers, 0 containers, 17 log entries) and the daily ~03:00 trigger is on.
  The backup login's password was changed the same day; if it changes again, `BACKUP_PASSWORD` in Script properties must be updated.
- 2026-11-12 — Added `backup/drive-backup.gs`: daily Firestore → Google Drive backup via Google Apps Script (see "Daily backup"
  section). Logic tested only against a mock of Google's services; NOT yet run for real — Ahmed still has to install it
  (paste, Script properties, run `setup`). Left undone: app import does not restore containers/log.
- 2026-11-11 — Customer page: new card "مكسبنا منه (المستلم)" = profit of his locked stages only (profit1 where `lock1`,
  profit2 where `lock2`), plus the count of locked stages. Ahmed chose received-only over total/expected. Display only — `calc`/`sync` untouched.
- 2026-11-11 — Profits page list: lock date now sits under its header, profit column aligned to the edge and bolder, and the
  list total is a larger green/red "الإجمالي · N مرحلة" pill (was a small plain number). Visual only.
- 2026-11-11 — New look (Ahmed approved from before/after screenshots, inspired by a dashboard he sent): floating top bar instead of
  the side menu, welcome banner with attention chips (cars with balance due, missing payment cost, auction advances, cars waiting
  for a container), tinted KPI cards with icons, section titles, new buttons. Visual only — `calc`/`sync` untouched. On phones the
  tab labels are shortened ("المواني", "السجل") and the tracking-page link is hidden from the bottom bar. Tracking page (`#track`) not
  re-checked under the new theme. Also: Ahmed's GitHub upload f219b1a was the same code with every line double-spaced; restored the
  clean file before applying the design.
- 2026-11-11 — Reverted commit 3948fa7 ("Update index.html", uploaded by Ahmed by hand on GitHub, removed ~1370 lines) at his request;
  `index.html` is back to the c0238c8 version. The reverted version is still in git history if he wants parts of it back.
- 2026-11-11 — Added this CLAUDE.md + SessionStart `git pull` hook so sessions on any computer stay in sync.
- 2026-11-10 — "سلف المكتب للمزاد" card is clickable → list of cars with outstanding auction advance.
- 2026-11-09 — Containers: pick any cars from any port, move between containers, shipping company (Atlantic Express, MTL).
- 2026-11-09 — Containers feature (2/3/4 buttons, grouping screen, containers page, cost split, warning); Tajawal font.
- 2026-11-09 — Change log (append-only in Firestore rules); auction payment-cost prompt + warning.
- 2026-11-08 — GitHub + Vercel deploy, tracking page, logo, side menu, extra charges box, per-stage balances, profit colors.
