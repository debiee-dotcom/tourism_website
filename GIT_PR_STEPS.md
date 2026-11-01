# Merge the integrated project into your existing Git clone

This extracted folder intentionally contains **no `.git` directory**, secrets or `node_modules`.
Keep your existing `tourism_website` clone and its Git history.

## 1. Test the extracted project first

Open Terminal in this extracted folder. Copy `.env.example` to `.env` and edit the MySQL connection settings. On a **brand-new, empty local database only** run:

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/catalog_seed.sql
```

**If you already have a MySQL database, do not overwrite it with this schema.** Coordinate migrations with the backend teammate.

Then run:

```bash
npm ci
npm run check
npm start
```

Check `http://localhost:3000/api/health` (expects `database: Connected`). Then open:
- Customer: http://localhost:3000/
- Customer/provider login: http://localhost:3000/login.html
- Provider: http://localhost:3000/provider/dashboard.html
- Admin login: http://localhost:3000/admin/login.html
- Super Admin login: http://localhost:3000/superadmin/login.html

New provider accounts need an admin to approve them, and new packages need package approval and future availability before customers can book.

## 2. Prepare a pull request from the existing clone

In a NEW Terminal, enter your **existing** `tourism_website` Git clone and update main:

```bash
cd ~/tourism_website
git status
# Stop here if you have uncommitted changes; save or commit them first.
git switch main
git pull --ff-only origin main
git switch -c feature/integrate-provider-admin
```

In this example, `~/Downloads/LocalTrails_Integrated` means the extracted folder from this ZIP. Adjust its location if different:

```bash
rsync -av --exclude='.git' --exclude='.env' --include='.env.example' --exclude='.env.*' --exclude='node_modules' --exclude='.DS_Store' ~/Downloads/LocalTrails_Integrated/ ~/tourism_website/
```

Review, check and commit:

```bash
cd ~/tourism_website
npm ci
npm run check
git status
git diff --check
git add .
git diff --cached --name-only
# Confirm .env, node_modules and secrets are NOT staged.
git commit -m "Integrate provider, admin and super admin dashboards"
git push -u origin feature/integrate-provider-admin
```

In GitHub, open a pull request with base `main` and compare `feature/integrate-provider-admin`. Request teammate review of server, SQL and authorization changes before merging.

## Deployment warning

Development integration only: MySQL end-to-end tests, HTTPS, CSRF defenses, persistent sessions and real payment processing are still required for production. Do not use simulated payment processing to accept real payments.
