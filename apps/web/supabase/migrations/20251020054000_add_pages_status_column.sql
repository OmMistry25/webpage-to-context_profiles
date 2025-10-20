-- Add missing status column to pages table
ALTER TABLE pages ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Update existing pages to have a status
UPDATE pages SET status = 'completed' WHERE status IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);
CREATE INDEX IF NOT EXISTS idx_pages_crawl_id_status ON pages(crawl_id, status);
