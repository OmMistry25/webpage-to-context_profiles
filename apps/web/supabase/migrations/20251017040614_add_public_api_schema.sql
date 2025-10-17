-- Migration: Add public API schema for API keys and usage tracking
-- This enables companies to access the core functionality via API keys

-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_name text NOT NULL,
  key_hash text UNIQUE NOT NULL,
  key_prefix text NOT NULL, -- First 8 characters for identification
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  last_used_at timestamp with time zone,
  expires_at timestamp with time zone
);

-- Create API usage tracking table
CREATE TABLE IF NOT EXISTS api_usage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id uuid REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  response_time_ms integer,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON api_keys(created_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_key_id ON api_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);

-- Create function to generate API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TABLE(key_value text, key_hash text, key_prefix text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  key_value text;
  key_hash text;
  key_prefix text;
BEGIN
  -- Generate a random API key (32 characters)
  key_value := encode(gen_random_bytes(24), 'base64');
  key_value := replace(replace(key_value, '+', '-'), '/', '_');
  key_value := rtrim(key_value, '=');
  
  -- Create hash for storage
  key_hash := encode(digest(key_value, 'sha256'), 'hex');
  
  -- Create prefix for identification
  key_prefix := left(key_value, 8);
  
  RETURN QUERY SELECT key_value, key_hash, key_prefix;
END;
$$;

-- Create function to validate API key
CREATE OR REPLACE FUNCTION validate_api_key(p_key_value text)
RETURNS TABLE(
  is_valid boolean,
  key_id uuid,
  key_name text,
  created_by uuid,
  is_active boolean,
  expires_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  key_hash text;
  result_record record;
BEGIN
  -- Hash the provided key
  key_hash := encode(digest(p_key_value, 'sha256'), 'hex');
  
  -- Look up the key
  SELECT 
    true as is_valid,
    ak.id as key_id,
    ak.key_name,
    ak.created_by,
    ak.is_active,
    ak.expires_at
  INTO result_record
  FROM api_keys ak
  WHERE ak.key_hash = key_hash
    AND ak.is_active = true
    AND (ak.expires_at IS NULL OR ak.expires_at > now());
  
  -- If no key found, return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false as is_valid,
      null::uuid as key_id,
      null::text as key_name,
      null::uuid as created_by,
      false as is_active,
      null::timestamp with time zone as expires_at;
  ELSE
    -- Update last used timestamp
    UPDATE api_keys 
    SET last_used_at = now()
    WHERE id = result_record.key_id;
    
    RETURN QUERY SELECT 
      result_record.is_valid,
      result_record.key_id,
      result_record.key_name,
      result_record.created_by,
      result_record.is_active,
      result_record.expires_at;
  END IF;
END;
$$;

-- Create function to log API usage
CREATE OR REPLACE FUNCTION log_api_usage(
  p_api_key_id uuid,
  p_endpoint text,
  p_method text,
  p_status_code integer,
  p_response_time_ms integer DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO api_usage (
    api_key_id,
    endpoint,
    method,
    status_code,
    response_time_ms,
    ip_address,
    user_agent
  ) VALUES (
    p_api_key_id,
    p_endpoint,
    p_method,
    p_status_code,
    p_response_time_ms,
    p_ip_address,
    p_user_agent
  );
END;
$$;

-- Create function to get API usage stats
CREATE OR REPLACE FUNCTION get_api_usage_stats(
  p_api_key_id uuid,
  p_hours integer DEFAULT 24
)
RETURNS TABLE(
  total_requests bigint,
  successful_requests bigint,
  failed_requests bigint,
  avg_response_time numeric,
  unique_endpoints bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as successful_requests,
    COUNT(*) FILTER (WHERE status_code >= 400) as failed_requests,
    ROUND(AVG(response_time_ms), 2) as avg_response_time,
    COUNT(DISTINCT endpoint) as unique_endpoints
  FROM api_usage
  WHERE api_key_id = p_api_key_id
    AND created_at >= now() - (p_hours || ' hours')::interval;
END;
$$;

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for api_keys
CREATE POLICY "Users can view their own API keys" ON api_keys
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own API keys" ON api_keys
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own API keys" ON api_keys
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own API keys" ON api_keys
  FOR DELETE USING (auth.uid() = created_by);

-- Create RLS policies for api_usage
CREATE POLICY "Users can view usage for their API keys" ON api_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM api_keys 
      WHERE api_keys.id = api_usage.api_key_id 
      AND api_keys.created_by = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON api_keys TO authenticated;
GRANT ALL ON api_usage TO authenticated;
GRANT EXECUTE ON FUNCTION generate_api_key() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_api_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION log_api_usage(uuid, text, text, integer, integer, inet, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_api_usage_stats(uuid, integer) TO authenticated;
