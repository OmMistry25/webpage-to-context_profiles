-- Add crawl_id column to jobs table for easier querying
ALTER TABLE jobs ADD COLUMN crawl_id UUID REFERENCES crawls(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_jobs_crawl_id ON jobs(crawl_id);

-- Update existing jobs to use the new column structure
-- (This will be empty for new installations)
UPDATE jobs SET crawl_id = (payload->>'crawl_id')::UUID WHERE payload ? 'crawl_id';
