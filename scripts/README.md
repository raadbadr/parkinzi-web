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
3. *(Optional)* Override the model via a repo variable:
   - Name: `ANTHROPIC_MODEL`
   - Value: e.g. `claude-sonnet-4-5` or `claude-opus-4-5`

## Cost

Roughly 5–7 USD per month at the default settings (Sonnet 4.5, 4 web searches per run, ~1k tokens of input + 3k of output per post). Watch your Anthropic dashboard for actuals.

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
