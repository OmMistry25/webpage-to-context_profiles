-- Enable Row Level Security on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawls ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view their own projects" ON projects
    FOR SELECT USING (auth.uid() = owner);

CREATE POLICY "Users can insert their own projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = owner);

CREATE POLICY "Users can update their own projects" ON projects
    FOR UPDATE USING (auth.uid() = owner);

CREATE POLICY "Users can delete their own projects" ON projects
    FOR DELETE USING (auth.uid() = owner);

-- Crawls policies (users can only access crawls for their own projects)
CREATE POLICY "Users can view crawls for their own projects" ON crawls
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = crawls.project_id 
            AND projects.owner = auth.uid()
        )
    );

CREATE POLICY "Users can insert crawls for their own projects" ON crawls
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = crawls.project_id 
            AND projects.owner = auth.uid()
        )
    );

CREATE POLICY "Users can update crawls for their own projects" ON crawls
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = crawls.project_id 
            AND projects.owner = auth.uid()
        )
    );

CREATE POLICY "Users can delete crawls for their own projects" ON crawls
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = crawls.project_id 
            AND projects.owner = auth.uid()
        )
    );

-- Pages policies (users can only access pages for their own projects)
CREATE POLICY "Users can view pages for their own projects" ON pages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM crawls 
            JOIN projects ON projects.id = crawls.project_id
            WHERE crawls.id = pages.crawl_id 
            AND projects.owner = auth.uid()
        )
    );

CREATE POLICY "Users can insert pages for their own projects" ON pages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM crawls 
            JOIN projects ON projects.id = crawls.project_id
            WHERE crawls.id = pages.crawl_id 
            AND projects.owner = auth.uid()
        )
    );

CREATE POLICY "Users can update pages for their own projects" ON pages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM crawls 
            JOIN projects ON projects.id = crawls.project_id
            WHERE crawls.id = pages.crawl_id 
            AND projects.owner = auth.uid()
        )
    );

CREATE POLICY "Users can delete pages for their own projects" ON pages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM crawls 
            JOIN projects ON projects.id = crawls.project_id
            WHERE crawls.id = pages.crawl_id 
            AND projects.owner = auth.uid()
        )
    );

-- Chunks policies (users can only access chunks for their own projects)
CREATE POLICY "Users can view chunks for their own projects" ON chunks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pages 
            JOIN crawls ON crawls.id = pages.crawl_id
            JOIN projects ON projects.id = crawls.project_id
            WHERE pages.id = chunks.page_id 
            AND projects.owner = auth.uid()
        )
    );

CREATE POLICY "Users can insert chunks for their own projects" ON chunks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM pages 
            JOIN crawls ON crawls.id = pages.crawl_id
            JOIN projects ON projects.id = crawls.project_id
            WHERE pages.id = chunks.page_id 
            AND projects.owner = auth.uid()
        )
    );

CREATE POLICY "Users can update chunks for their own projects" ON chunks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM pages 
            JOIN crawls ON crawls.id = pages.crawl_id
            JOIN projects ON projects.id = crawls.project_id
            WHERE pages.id = chunks.page_id 
            AND projects.owner = auth.uid()
        )
    );

CREATE POLICY "Users can delete chunks for their own projects" ON chunks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM pages 
            JOIN crawls ON crawls.id = pages.crawl_id
            JOIN projects ON projects.id = crawls.project_id
            WHERE pages.id = chunks.page_id 
            AND projects.owner = auth.uid()
        )
    );

-- Jobs policies (service role can access all, users can only view jobs for their projects)
CREATE POLICY "Service role can access all jobs" ON jobs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view jobs for their own projects" ON jobs
    FOR SELECT USING (
        payload->>'project_id' IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id::text = payload->>'project_id'
            AND projects.owner = auth.uid()
        )
    );

-- Bundles policies (users can only access bundles for their own projects)
CREATE POLICY "Users can view bundles for their own projects" ON bundles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = bundles.project_id 
            AND projects.owner = auth.uid()
        )
    );

CREATE POLICY "Users can insert bundles for their own projects" ON bundles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = bundles.project_id 
            AND projects.owner = auth.uid()
        )
    );

CREATE POLICY "Users can update bundles for their own projects" ON bundles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = bundles.project_id 
            AND projects.owner = auth.uid()
        )
    );

CREATE POLICY "Users can delete bundles for their own projects" ON bundles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = bundles.project_id 
            AND projects.owner = auth.uid()
        )
    );
