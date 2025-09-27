# Web to Context Profile

A hybrid web app and Chrome extension for creating context profiles from websites.

## Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm (or npm)
- Supabase account and project

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd webpage-to-context_profiles
   npm install
   ```

2. **Set up Supabase:**
   - Create a new Supabase project at [supabase.com](https://supabase.com)
   - Get your project URL and anon key from Settings > API
   - Create a `.env.local` file in `apps/web/` with:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
     SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
     ```

3. **Apply database migrations:**
   ```bash
   npm run migrate
   ```
   Follow the instructions to apply the SQL migrations to your Supabase database.

4. **Test database connection:**
   ```bash
   npm run test:db
   ```

5. **Start development:**
   ```bash
   npm run dev
   ```

## Project Structure

```
web-to-context-profile/
├── apps/
│   └── web/                    # Next.js web application
├── packages/
│   ├── crawler/               # Web crawler worker
│   ├── embedder/              # Text embedding worker  
│   ├── bundler/               # Export bundle creator
│   └── extension/             # Chrome extension
├── infra/
│   └── supabase/
│       └── migrations/        # Database migrations
└── scripts/                   # Utility scripts
```

## Development

- `npm run dev` - Start all development servers
- `npm run build` - Build all packages
- `npm run lint` - Lint all packages
- `npm run migrate` - Show migration instructions
- `npm run test:db` - Test database connection

## Architecture

This is a hybrid architecture with:
- **Web App**: Next.js 15 with App Router, Tailwind, Supabase
- **Chrome Extension**: MV3 extension for quick crawl initiation
- **Workers**: Node.js workers for crawling, embedding, and bundling
- **Database**: Supabase Postgres with pgvector for embeddings

See `architecture.md` for detailed technical specifications.

## Tasks

See `tasks.md` for the complete build plan and current progress.