# Blog automation

This folder contains the daily-blog pipeline for parkinzi.com.

## What runs

`.github/workflows/daily-blog-post.yml` runs every day at **10:00 Asia/Riyadh** (07:00 UTC) and does:

1. `scripts/generate-daily-post.js` — calls Claude Sonnet 4.5 with web search to research the latest in smart parking, then produces a JSON post object (Arabic, 600–900 words, with H2/H3, lists, blockquotes). Writes a new HTML file into `blog/<slug>.html` and appends metadata to `blog/posts.json`.
2. `scripts/regen-sitemap-feed.js` — rebuilds `/sitemap.xml` and `/blog/feed.xml` from `blog/posts.json`.
3. Commits and pushes. Cloudflare Pages picks the push up and deploys.

Manual trigger is available from the **Actions → Daily Blog Post → Run workflow** button.

## One-time setup

You need to add the Anthropic API key as a repository secret:

1. Go to **GitHub → repo settings → Secrets and variables → Actions**.
2. Add a new repository secret:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your key from <https://console.anthropic.com/settings/keys>

## Optional repo *variables* (Settings → Variables tab)

All have safe defaults — only set them if you want to override.

| Variable | Default | Notes |
| --- | --- | --- |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` | Use `claude-sonnet-4-5` for higher quality (~5x cost). |
| `WEB_SEARCH_USES` | `0` | Web search is off by default. `1`+ enables fresh news at $0.01/search. |
| `MAX_TOKENS` | `3500` | Output token cap. Lower for shorter posts. |

## Cost (default settings)

- ~2K input tokens × $1/M = $0.002
- ~3K output tokens × $5/M = $0.015
- **~$0.017 per run ≈ $0.50 per month (~2 SAR)**

Add web_search (1 query) → ~$1/month. Sonnet 4.5 + 4 searches → ~$5/month.

## Quality gates

`generate-daily-post.js` refuses to write a post if any of these is true:
- Claude omits a required field (slug / title / summary / body / tags)
- Body has fewer than 800 chars of visible text
- Body contains zero `<h2>` headings
- Body contains a dollar/USD price, an external URL, or `<script>` / `<style>` / `<iframe>` (anti-hallucination + anti-XSS)

A failure exits with code 1, GitHub emails you, and nothing is pushed.

## Running locally

```bash
cd scripts
npm install
ANTHROPIC_API_KEY=sk-ant-... node generate-daily-post.js
node regen-sitemap-feed.js
```

`generate-daily-post.js` refuses to overwrite an existing post with the same date-prefixed slug, so it is safe to re-run.

## Topics

The topic for each day comes from `TOPIC_POOL` inside `generate-daily-post.js`, selected by day-of-year so the cycle repeats roughly every 30 days. Edit that array to add or remove themes.
