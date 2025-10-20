-- Migration: Add CLI API permissions and OAuth client management
-- This migration adds support for third-party applications to access user data via CLI

-- Create CLI clients table for OAuth applications
CREATE TABLE IF NOT EXISTS cli_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    client_id TEXT UNIQUE NOT NULL,
    client_secret TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create user permissions table for CLI access
CREATE TABLE IF NOT EXISTS user_cli_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL REFERENCES cli_clients(client_id) ON DELETE CASCADE,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    filters JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, client_id)
);

-- Create audit logs table for CLI access tracking
CREATE TABLE IF NOT EXISTS cli_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL REFERENCES cli_clients(client_id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    endpoint TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rate limiting table for CLI access
CREATE TABLE IF NOT EXISTS cli_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL REFERENCES cli_clients(client_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    requests_per_minute INTEGER DEFAULT 60,
    requests_per_hour INTEGER DEFAULT 1000,
    requests_per_day INTEGER DEFAULT 10000,
    current_minute_count INTEGER DEFAULT 0,
    current_hour_count INTEGER DEFAULT 0,
    current_day_count INTEGER DEFAULT 0,
    minute_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    hour_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    day_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, user_id, endpoint)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cli_clients_client_id ON cli_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_user_cli_permissions_user_id ON user_cli_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cli_permissions_client_id ON user_cli_permissions(client_id);
CREATE INDEX IF NOT EXISTS idx_user_cli_permissions_expires_at ON user_cli_permissions(expires_at);
CREATE INDEX IF NOT EXISTS idx_cli_audit_logs_user_id ON cli_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cli_audit_logs_client_id ON cli_audit_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_cli_audit_logs_created_at ON cli_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_cli_rate_limits_client_user ON cli_rate_limits(client_id, user_id);

-- Enable Row Level Security
ALTER TABLE cli_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cli_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cli_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cli_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cli_clients
CREATE POLICY "Users can view their own CLI clients" ON cli_clients
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create CLI clients" ON cli_clients
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own CLI clients" ON cli_clients
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own CLI clients" ON cli_clients
    FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for user_cli_permissions
CREATE POLICY "Users can view their own permissions" ON user_cli_permissions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own permissions" ON user_cli_permissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own permissions" ON user_cli_permissions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own permissions" ON user_cli_permissions
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for cli_audit_logs
CREATE POLICY "Users can view their own audit logs" ON cli_audit_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create audit logs" ON cli_audit_logs
    FOR INSERT WITH CHECK (true);

-- RLS Policies for cli_rate_limits
CREATE POLICY "System can manage rate limits" ON cli_rate_limits
    FOR ALL USING (true);

-- Create functions for CLI authentication
CREATE OR REPLACE FUNCTION generate_client_credentials()
RETURNS TABLE(client_id TEXT, client_secret TEXT) AS $$
BEGIN
    RETURN QUERY SELECT 
        encode(gen_random_bytes(16), 'hex') as client_id,
        encode(gen_random_bytes(32), 'hex') as client_secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check CLI permissions
CREATE OR REPLACE FUNCTION check_cli_permission(
    p_user_id UUID,
    p_client_id TEXT,
    p_required_scope TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM user_cli_permissions 
        WHERE user_id = p_user_id 
        AND client_id = p_client_id 
        AND p_required_scope = ANY(scopes)
        AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log CLI access
CREATE OR REPLACE FUNCTION log_cli_access(
    p_user_id UUID,
    p_client_id TEXT,
    p_action TEXT,
    p_resource TEXT,
    p_resource_id TEXT,
    p_endpoint TEXT,
    p_ip_address INET,
    p_user_agent TEXT,
    p_success BOOLEAN,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO cli_audit_logs (
        user_id, client_id, action, resource, resource_id, 
        endpoint, ip_address, user_agent, success, error_message
    ) VALUES (
        p_user_id, p_client_id, p_action, p_resource, p_resource_id,
        p_endpoint, p_ip_address, p_user_agent, p_success, p_error_message
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_client_id TEXT,
    p_user_id UUID,
    p_endpoint TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    rate_limit_record RECORD;
    current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Get or create rate limit record
    INSERT INTO cli_rate_limits (client_id, user_id, endpoint)
    VALUES (p_client_id, p_user_id, p_endpoint)
    ON CONFLICT (client_id, user_id, endpoint) DO NOTHING;
    
    -- Get the rate limit record
    SELECT * INTO rate_limit_record
    FROM cli_rate_limits
    WHERE client_id = p_client_id 
    AND user_id = p_user_id 
    AND endpoint = p_endpoint;
    
    -- Reset counters if needed
    IF rate_limit_record.minute_reset_at < current_time THEN
        UPDATE cli_rate_limits 
        SET current_minute_count = 0, minute_reset_at = current_time + INTERVAL '1 minute'
        WHERE id = rate_limit_record.id;
        rate_limit_record.current_minute_count := 0;
    END IF;
    
    IF rate_limit_record.hour_reset_at < current_time THEN
        UPDATE cli_rate_limits 
        SET current_hour_count = 0, hour_reset_at = current_time + INTERVAL '1 hour'
        WHERE id = rate_limit_record.id;
        rate_limit_record.current_hour_count := 0;
    END IF;
    
    IF rate_limit_record.day_reset_at < current_time THEN
        UPDATE cli_rate_limits 
        SET current_day_count = 0, day_reset_at = current_time + INTERVAL '1 day'
        WHERE id = rate_limit_record.id;
        rate_limit_record.current_day_count := 0;
    END IF;
    
    -- Check if limits are exceeded
    IF rate_limit_record.current_minute_count >= rate_limit_record.requests_per_minute OR
       rate_limit_record.current_hour_count >= rate_limit_record.requests_per_hour OR
       rate_limit_record.current_day_count >= rate_limit_record.requests_per_day THEN
        RETURN FALSE;
    END IF;
    
    -- Increment counters
    UPDATE cli_rate_limits 
    SET 
        current_minute_count = current_minute_count + 1,
        current_hour_count = current_hour_count + 1,
        current_day_count = current_day_count + 1
    WHERE id = rate_limit_record.id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a sample CLI client for testing
INSERT INTO cli_clients (name, description, client_id, client_secret, redirect_uri, scopes, created_by)
VALUES (
    'Test CLI Client',
    'Development CLI client for testing',
    'test-cli-client-123',
    'test-client-secret-456',
    'http://localhost:8080/callback',
    ARRAY['read:projects', 'read:crawls', 'search:chunks', 'export:data'],
    (SELECT id FROM auth.users LIMIT 1)
) ON CONFLICT (client_id) DO NOTHING;
