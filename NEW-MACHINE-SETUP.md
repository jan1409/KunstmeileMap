# Moving KunstmeileMap to a new computer

A practical checklist for getting this project running on a fresh machine that
only has **VS Code** and **Claude** installed. Windows 11 assumed (adjust paths
for macOS/Linux).

> The code itself lives on GitHub: <https://github.com/jan1409/KunstmeileMap>.
> `git clone` brings the code, but **three things it does NOT bring** — read the
> "What git does not carry over" section first.

---

## 1. Install the software

| Tool | Why | How (Windows) |
|---|---|---|
| **Git** | clone / commit / push | <https://git-scm.com/download/win> (or `winget install Git.Git`) |
| **Node.js ≥ 20 LTS** | runs the app/build (project requires `node >=20`; 20 or 22 LTS recommended) | <https://nodejs.org> (or `winget install OpenJS.NodeJS.LTS`) |
| **pnpm** | the project's package manager (`pnpm-lock.yaml` is committed — do **not** use npm) | `corepack enable` (ships with Node), then pnpm auto-installs. Fallback: `npm i -g pnpm` |
| GitHub CLI `gh` *(optional)* | create PRs, `gh auth login` for push auth | `winget install GitHub.cli` |
| Supabase CLI *(optional)* | only if you run DB migrations or `pnpm types:gen` | `npm i -g supabase` or scoop/standalone |
| Playwright Chromium *(optional)* | only for docs screenshots (`pnpm docs:shots`) | `pnpm playwright install chromium` |

You do **not** need the Vercel CLI — production/preview deploys happen
automatically from GitHub via the Vercel integration.

---

## 2. What git does NOT carry over (the important part)

1. **`.env.local`** — your real Supabase keys. It's gitignored, so it is **not**
   on GitHub. You must recreate it (see step 4). `.env.example` is the template.
2. **Claude's project memory** — the notes Claude keeps about this project live in
   your user folder, not the repo:
   `C:\Users\<you>\.claude\projects\c--Users-<you>-Code-KunstmeileMap\memory\`
   (the `MEMORY.md` index + the `project_*` / `feedback_*` files). If you want
   Claude to retain context on the new machine, copy this folder over.
   ⚠️ The folder name is derived from the repo's absolute path, so **clone to the
   same path** (see step 3) or the slug won't match.
3. **Tool authentication** — Git/GitHub credentials, and optionally Supabase CLI
   login. Set up in step 5.

---

## 3. Clone the repo (to the matching path)

To keep Claude's memory path consistent, clone to the same location you used
before:

```powershell
mkdir C:\Users\<you>\Code
cd C:\Users\<you>\Code
git clone https://github.com/jan1409/KunstmeileMap.git
cd KunstmeileMap
```

Then fetch the in-progress branch too (if you want to keep working on it):

```powershell
git fetch origin
git switch feat/walk-mode-controller   # optional; main is the default
```

---

## 4. Recreate `.env.local`

```powershell
copy .env.example .env.local
```

Then open `.env.local` and fill in the real values from the **Supabase project
dashboard → Project Settings → API**:

```
VITE_SUPABASE_URL=        # Project URL
VITE_SUPABASE_ANON_KEY=   # anon / public key
VITE_DEFAULT_EVENT_SLUG=kunstmeile-2026
```

> Easiest of all: just copy your existing `.env.local` from the old computer
> (USB / secure transfer). These are the anon (public) keys, but still treat the
> file as private.

---

## 5. Authenticate Git & tools

```powershell
git config --global user.name  "Jan Poepke"
git config --global user.email "jpoepke@gmail.com"

# To be able to push: either
gh auth login            # if you installed the GitHub CLI, or
# let VS Code / Git Credential Manager prompt you on first push, or use a PAT/SSH key
```

Optional, only if you touch the database schema:

```powershell
supabase login                              # paste an access token from the dashboard
supabase link --project-ref <your-ref>      # ref is in the Supabase dashboard URL
```

---

## 6. Install deps & run

```powershell
pnpm install
pnpm dev          # → http://localhost:5173
```

Verify the toolchain end-to-end:

```powershell
pnpm test:run     # Vitest — should be all green
pnpm type-check   # tsc, no errors
pnpm lint         # eslint, clean
pnpm build        # production build succeeds
```

If all four pass and `pnpm dev` shows the map with data, the migration is
complete.

---

## 7. Recommended order (fastest path)

1. On the **old** machine: confirm everything is pushed —
   `git status` (clean) and `git log origin/main..main` (empty). ✅ Already done.
2. Grab two things off the old machine: **`.env.local`** and the **Claude memory
   folder** (step 2). Everything else comes from GitHub.
3. On the **new** machine: install Git + Node + enable pnpm (step 1).
4. Clone to the matching path (step 3), drop in `.env.local` (step 4), set Git
   auth (step 5).
5. `pnpm install && pnpm dev` (step 6). Done.

---

## Reference

- Full install/deploy docs (Vercel + Supabase, Azure, AWS):
  [`docs/installation/`](docs/installation/) (DE) and
  [`docs/en/installation/`](docs/en/installation/) (EN).
- Live docs site: <https://jan1409.github.io/KunstmeileMap/>
- Project README: [`README.md`](README.md).
</content>
