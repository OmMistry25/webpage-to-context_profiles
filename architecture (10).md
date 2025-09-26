# Web-to-Context-Profile: Hybrid Architecture (Web App + Chrome Extension)

## Tech choices
- Frontend: Next.js 15 with App Router, TypeScript, Tailwind, shadcn/ui, React Query
- Backend runtime: Next.js API routes and Edge functions for light work. Dedicated Node workers for crawling and embeddings
- Database: Supabase Postgres with pgvector for embeddings
- Auth: Supabase Auth with OAuth and magic links
- Queue: Supabase Queue or a simple jobs table with advisory locks. Redis is optional later
- Headless browser: Playwright for JS-rendered pages. Fallback: undici + jsdom for static pages
- Extraction: Readability, Cheerio, micromarkdown, token aware chunking
- Storage: Supabase Storage for HTML, Markdown, and export bundles
- RAG: Hybrid search over pgvector and Postgres full text. Optional small rerank
- Browser integration: Chrome extension MV3 with service worker, content script, and popup

## High level flow
1. User visits a site and clicks the extension
2. Extension collects the active tab URL and an optional DOM snapshot preview
3. Extension calls the web app API to create or reuse a project and to start a crawl
4. Crawler fetches the root page, parses links, respects robots, and explores subpages within scope and limits
5. Parser normalizes to Markdown plus metadata, then the embedder computes vectors for chunks
6. Web app shows an interactive knowledge base and allows export of an LLM friendly bundle
7. Extension displays crawl status and a link to the project page in the web app

## Data model
The schema matches the web app centric version with no changes, since the extension is a thin client. See the tables in the earlier version: projects, crawls, pages, chunks, jobs, bundles. RLS limits per user access.

## Exportable Context Profile format
Format name: profile-v1. Bundle contains manifest.json, pages.csv, graph.json, raw HTML, Markdown, chunks.jsonl, optional embeddings.npy, plus prompt packs. Same layout as before for maximum portability.

## Repository layout
```
web-to-context-profile/
  apps/
    web/                         
      app/
        dashboard/
          page.tsx
          [projectId]/page.tsx
          [projectId]/crawl/page.tsx
          [projectId]/kb/page.tsx
          [projectId]/chat/page.tsx
        api/
          crawl/route.ts
          pages/route.ts
          bundles/route.ts
          retriever/route.ts
      components/
      lib/
      styles/
      hooks/
      next.config.mjs
      tailwind.config.ts
  packages/
    crawler/
      src/{index.ts, orchestrator.ts, fetcher.ts, parse.ts, links.ts, robots.ts, sitemap.ts, rate-limit.ts, storage.ts, db.ts}
      bin/crawler.ts
    embedder/
      src/{index.ts, queue.ts, embed.ts, db.ts}
    bundler/
      src/{index.ts, writer.ts, manifest.ts}
      promptpacks/{retriever.md, system.md}
    extension/                     
      public/
        icon16.png
        icon32.png
        icon128.png
      src/
        manifest.json
        service_worker.ts          # MV3 background service worker
        content_script.ts          # runs in page to read DOM when the user asks
        popup/
          index.html
          popup.tsx
        api.ts                     # typed client for web app endpoints
        messaging.ts               # runtime message passing and tab linking
        storage.ts                 # sync local settings like default scope
      package.json
  infra/
    supabase/
      migrations/
      policies.sql
    docker/
      crawler.Dockerfile
      embedder.Dockerfile
    deploy/
      fly.toml or railway.json
      worker.procfile
  scripts/
    dev.sh
    seed.sql
    ci-checks.sh
  .env.example
  package.json
  turbo.json
  README.md
```

## What the extension does
- Popup UI lets the user pick scope, depth, page cap, and target project
- Content script can read a sanitized DOM preview on user action
- Service worker posts to `/api/crawl` and subscribes to progress using polling or server sent events
- Shows a tiny status card with current counts and a button to open the project in the web app

## Permissions and privacy
- Minimal permissions: `activeTab`, `scripting`, `storage`. `tabs` only if you need to read URLs in all tabs
- No persistent background tasks. Service worker wakes on user action
- DOM access happens only after explicit user click, and the preview is sanitized by removing inputs and scripts

## Where state lives
- All durable state is in Supabase. The extension has only ephemeral UI state and small preferences in `chrome.storage.local`
- Crawl state lives in `crawls`, `pages`, `jobs`. Artifacts are in Storage. Embeddings are in `chunks`

## Services and connections
- Extension -> Web app API: start crawl, poll status, open project. Auth uses Supabase PKCE in a web view or session cookies if user is signed in in the same browser profile
- Crawler and Embedder use service keys and write to DB and Storage
- Web app serves the Knowledge Base and export downloads

## Crawling and extraction
- Same strategy as before. Add a preflight check that fetches robots and sitemap for scope estimation. The extension asks the web app to show the preflight in a new tab

## RAG and interactive KB
- Same as before. The extension is not required for searching or chat. It only makes starting a crawl quicker

## Export and LLM injection
- Same as before. The extension adds a quick Export button that simply opens the web app export page for the current project

## Security and compliance
- Strong RLS by `owner` and `project_id`
- Signed Storage URLs with expiry
- Respect robots and site terms. Expose settings in the UI and bundle manifest for transparency

## Local development
- `supabase start` for local DB and Storage
- `pnpm dev` in web and `pnpm --filter packages/* dev` for workers
- `pnpm --filter packages/extension dev` to run the extension build with Vite and load as unpacked in Chrome
```