# MVP Build Plan - Hybrid Version

Each task is tiny, testable, and focused.

## Bootstrap
1. Create repo with Turborepo layout that includes `apps/web`, `packages/crawler`, `packages/embedder`, `packages/bundler`, and `packages/extension`. End: install and build succeed.
2. Add Next.js App Router and Tailwind in `apps/web`. End: home renders.
3. Add Supabase client and server helpers. End: health check route returns ok.

## Database and auth
4. Apply SQL migrations for tables. End: tables exist.
5. Add RLS for projects, crawls, pages, chunks, bundles. End: RLS test passes.
6. Enable Supabase Auth. End: email magic link works in dev.

## Core web app
7. Projects dashboard with create project modal. End: row in `projects` created.
8. Project page shows crawl status and quick actions. End: reads `crawls` and `pages` counts.
9. API `POST /api/crawl` to enqueue a crawl. End: returns crawl id.

## Crawler
10. Worker polls `jobs` for crawl jobs. End: picks one and logs id.
11. Preflight: robots and sitemap fetch with scope and estimate. End: values saved on `crawls` row.
12. Fetcher saves raw HTML and metadata for the root page. End: `pages` row with `raw_html_path`.
13. Parser to Markdown and link extraction. End: `markdown_path`, `links` filled.
14. Scope and dedup with depth limit. End: no duplicate pages for same normalized URL.
15. Outlink expansion until caps hit. End: `pages` count increases.
16. JS rendering fallback with Playwright. End: dynamic page captured.

## Chunking and embeddings
17. Token aware splitter. End: chunks created for a page.
18. Embedder batches unembedded chunks to vectors. End: vectors saved in `chunks`.
19. Hybrid search SQL function. End: returns rows with score and url.

## Knowledge Base UI
20. KB page with tree map of site structure. End: loads for selected project.
21. Search box with server retrieval. End: shows snippets and deep links.
22. Chat page that uses retrieval and returns an answer with citations. End: visible answer with two or more sources.

## Export bundle
23. Bundler composes manifest, pages.csv, graph.json, chunks.jsonl, and writes a zip. End: zip in Storage.
24. API to create and fetch latest bundle. End: Export button downloads `profile-v1.zip`.
25. Include prompt packs in bundle. End: files present.

## Chrome extension MVP
26. Create MV3 manifest with minimal permissions and icons. End: extension loads as unpacked.
27. Popup UI with form for scope, depth, page cap, and project select. End: opens and saves preferences.
28. Active tab capture of URL and optional sanitized DOM preview after user click. End: preview appears in popup.
29. Call `POST /api/crawl` with form values. End: crawl starts and returns id.
30. Poll crawl status and show progress. End: counts update in popup.
31. Open project link button. End: opens web app project page.

## Finishing touches
32. Error states and retry in popup and web app. End: visible and works.
33. Preflight summary screen opened by the extension. End: user can review before starting.
34. Seed script to crawl `https://example.com/docs` depth 1. End: demo data available.
35. README that covers extension install, web app setup, and worker run. End: a teammate can reproduce locally.

## Nice to have after MVP
36. Server sent events for crawl progress instead of polling.
37. Reranker model toggle in settings.
38. Diff crawl that updates only changed pages.
39. Browser action to export the latest bundle with one click.
40. Firefox extension port with WebExtensions polyfill.