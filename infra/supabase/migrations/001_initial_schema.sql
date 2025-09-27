-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create crawls table
CREATE TABLE crawls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    root_url TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'domain', -- 'domain', 'subdomain', 'path'
    max_depth INTEGER NOT NULL DEFAULT 3,
    max_pages INTEGER NOT NULL DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    robots_checked BOOLEAN DEFAULT FALSE,
    sitemap_checked BOOLEAN DEFAULT FALSE,
    estimated_pages INTEGER,
    pages_crawled INTEGER DEFAULT 0,
    pages_failed INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pages table
CREATE TABLE pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crawl_id UUID NOT NULL REFERENCES crawls(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    status_code INTEGER,
    content_type TEXT,
    raw_html_path TEXT, -- Path in Supabase Storage
    markdown_path TEXT, -- Path in Supabase Storage
    links JSONB DEFAULT '[]'::jsonb, -- Array of discovered links
    depth INTEGER NOT NULL DEFAULT 0,
    crawled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(crawl_id, normalized_url)
);

-- Create chunks table
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    token_count INTEGER,
    embedding VECTOR(1536), -- OpenAI ada-002 embedding dimension
    chunk_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jobs table for queue management
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- 'crawl', 'embed', 'bundle'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    payload JSONB NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bundles table
CREATE TABLE bundles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version TEXT NOT NULL DEFAULT '1.0.0',
    storage_path TEXT NOT NULL, -- Path in Supabase Storage
    file_size BIGINT,
    pages_count INTEGER,
    chunks_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_projects_owner ON projects(owner);
CREATE INDEX idx_crawls_project_id ON crawls(project_id);
CREATE INDEX idx_crawls_status ON crawls(status);
CREATE INDEX idx_pages_crawl_id ON pages(crawl_id);
CREATE INDEX idx_pages_normalized_url ON pages(normalized_url);
CREATE INDEX idx_chunks_page_id ON chunks(page_id);
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_bundles_project_id ON bundles(project_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crawls_updated_at BEFORE UPDATE ON crawls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chunks_updated_at BEFORE UPDATE ON chunks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bundles_updated_at BEFORE UPDATE ON bundles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
