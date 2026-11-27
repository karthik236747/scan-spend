# ScanSpend – Barcode Expense Tracker

A simple, mobile-friendly expense tracker made for people who hate typing.

### Features
- **Scan barcodes** of groceries → product name is looked up automatically (Open Food Facts)
- **Quick add** price + category
- **Full category management**: Add, edit, delete, and color-code your own categories
- **Monthly total** + history with category filter
- **Download Excel (.xlsx)** – export your expenses (respects the current category filter). Perfect for tracking or turning into a grocery list
- Everything stays **on your phone** (localStorage) – no account needed
- Works as a **Progressive Web App** (Add to Home Screen)

### How to use on your phone

**Easiest way (GitHub Pages):**
1. Create a new GitHub repository
2. Upload all files from the `scan-spend` folder
3. Go to Settings → Pages → Source: Deploy from a branch → main / root
4. After a minute you’ll get a link like `https://yourusername.github.io/repo-name/`
5. Open that link on your phone and “Add to Home Screen”

**Or just open locally:**
1. Open `index.html` in Chrome / Safari
2. Note: camera needs HTTPS (or localhost) to work properly

For best experience:
- On Android Chrome → menu → “Add to Home screen”
- On iPhone Safari → Share → “Add to Home Screen”

### Default categories
- Groceries
- Bills
- Transport
- Eating Out
- Other

You can freely add, rename, recolor, or delete them.

### Notes
- Barcode lookup works best for packaged food (Open Food Facts).
- For bills / receipts without barcodes, just use **Manual Entry**.
- Prices are always entered by you (barcode databases don’t know your store’s price).
