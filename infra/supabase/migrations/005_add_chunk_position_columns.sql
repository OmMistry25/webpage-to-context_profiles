-- Add position tracking columns to chunks table
ALTER TABLE chunks 
ADD COLUMN start_char INTEGER,
ADD COLUMN end_char INTEGER;

-- Add index for better performance on position queries
CREATE INDEX idx_chunks_page_position ON chunks(page_id, chunk_index);
