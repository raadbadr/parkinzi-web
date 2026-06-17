# PARKINZI Website — Immutable Rules

These rules apply to every AI agent, developer, and automated tool working on this project.
**No exceptions without explicit written approval from المهندس رعد.**

---

## IMMUTABLE COMPONENTS — Never Touch Without Explicit Approval

| File / Path | What it is | Why it's locked |
|---|---|---|
| `favicon.ico` | Website favicon | Brand identity — must match original design |
| `favicon-32x32.png` | Favicon 32px | Brand identity |
| `apple-touch-icon.png` | iOS home screen icon | Brand identity |
| `src/worker.js` — `PUBLIC_SPOT_COLUMNS` | Public API column allowlist | PII protection — removing columns from this list can expose owner names, deed numbers, camera URLs |
| `src/worker.js` — `/mcp` route | MCP endpoint | AI assistant integration — must remain POST-only |
| `src/mcp.js` — tool schemas | MCP tool definitions | Published to official MCP Registry (com.parkinzi/parkinzi) — breaking changes require version bump |
| `/.well-known/mcp-registry-auth` | Domain verification key | Ed25519 public key — changing requires re-publishing to MCP Registry |
| `sitemap.xml` | SEO sitemap | Only add/remove pages intentionally — never remove live pages |
| `robots.txt` | Crawler rules | Never add `Disallow: /` or block AI crawlers |
| `.assetsignore` | Asset upload exclusions | Prevents source code exposure — never remove `src/` or `.github/` entries |
| `_headers` | Security headers | CSP/HSTS/XFO rules — weakening them opens security holes |

---

## Deployment Rules

- **Every push to `main` auto-deploys** via GitHub Actions (`deploy.yml`) + `wrangler deploy`
- **Never run `wrangler deploy` with `--env` flags** that override production secrets
- **CLOUDFLARE_API_TOKEN** lives in GitHub Secrets only — never commit it to any file
- **SUPABASE_ANON_KEY / SUPABASE_URL** live in Cloudflare Worker Secrets only — never hardcode

---

## Security Rules

- `select=*` on `/api/parking-spots` is **permanently blocked** — it exposed PII in production
- Never add a passthrough for `select=*` or expand `PUBLIC_SPOT_COLUMNS` without security review
- MCP tools must only read `PUBLIC_SPOT_COLUMNS` — never add write/delete tools to the MCP server
- `/mcp` endpoint is **POST-only** — GET requests must return the 404 page

---

## Brand Rules

- Favicon must always be the original PARKINZI icon (commit `d758980`)
- Never replace `favicon.ico`, `favicon-32x32.png`, or `apple-touch-icon.png` with iOS app icons or any other asset without explicit approval
- `brand-logo.js` replaces "PARKINZI" text nodes with the logo image — never disable or remove it
