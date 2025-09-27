-- Fix jobs RLS policies to allow INSERT operations and handle crawl_id in payload

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view jobs for their own projects" ON jobs;

-- Create new policies that allow INSERT and handle both project_id and crawl_id
CREATE POLICY "Users can view jobs for their own projects" ON jobs
    FOR SELECT USING (
        (
            payload->>'project_id' IS NOT NULL AND
            EXISTS (
                SELECT 1 FROM projects 
                WHERE projects.id::text = payload->>'project_id'
                AND projects.owner = auth.uid()
            )
        ) OR (
            payload->>'crawl_id' IS NOT NULL AND
            EXISTS (
                SELECT 1 FROM crawls 
                JOIN projects ON projects.id = crawls.project_id
                WHERE crawls.id::text = payload->>'crawl_id'
                AND projects.owner = auth.uid()
            )
        )
    );

-- Allow users to insert jobs for their own crawls
CREATE POLICY "Users can insert jobs for their own crawls" ON jobs
    FOR INSERT WITH CHECK (
        payload->>'crawl_id' IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM crawls 
            JOIN projects ON projects.id = crawls.project_id
            WHERE crawls.id::text = payload->>'crawl_id'
            AND projects.owner = auth.uid()
        )
    );

-- Allow users to update jobs for their own crawls
CREATE POLICY "Users can update jobs for their own crawls" ON jobs
    FOR UPDATE USING (
        payload->>'crawl_id' IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM crawls 
            JOIN projects ON projects.id = crawls.project_id
            WHERE crawls.id::text = payload->>'crawl_id'
            AND projects.owner = auth.uid()
        )
    );
