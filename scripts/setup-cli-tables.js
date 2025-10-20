const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../apps/web/.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}

envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function setupCLITables() {
  try {
    console.log('🚀 Setting up CLI tables...')
    
    // Test connection first
    console.log('🔍 Testing connection...')
    const { data: testData, error: testError } = await supabase.from('projects').select('count').limit(1)
    
    if (testError) {
      console.error('❌ Connection test failed:', testError)
      return false
    }
    
    console.log('✅ Connection successful')
    
    // Create CLI clients table
    console.log('📝 Creating cli_clients table...')
    const createClientsTable = `
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
    `
    
    const { error: clientsError } = await supabase.rpc('exec_sql', { sql: createClientsTable })
    if (clientsError) {
      console.error('❌ Failed to create cli_clients table:', clientsError)
    } else {
      console.log('✅ cli_clients table created')
    }
    
    // Create user permissions table
    console.log('📝 Creating user_cli_permissions table...')
    const createPermissionsTable = `
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
    `
    
    const { error: permissionsError } = await supabase.rpc('exec_sql', { sql: createPermissionsTable })
    if (permissionsError) {
      console.error('❌ Failed to create user_cli_permissions table:', permissionsError)
    } else {
      console.log('✅ user_cli_permissions table created')
    }
    
    // Create audit logs table
    console.log('📝 Creating cli_audit_logs table...')
    const createAuditTable = `
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
    `
    
    const { error: auditError } = await supabase.rpc('exec_sql', { sql: createAuditTable })
    if (auditError) {
      console.error('❌ Failed to create cli_audit_logs table:', auditError)
    } else {
      console.log('✅ cli_audit_logs table created')
    }
    
    // Create rate limiting table
    console.log('📝 Creating cli_rate_limits table...')
    const createRateLimitTable = `
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
    `
    
    const { error: rateLimitError } = await supabase.rpc('exec_sql', { sql: createRateLimitTable })
    if (rateLimitError) {
      console.error('❌ Failed to create cli_rate_limits table:', rateLimitError)
    } else {
      console.log('✅ cli_rate_limits table created')
    }
    
    // Create indexes
    console.log('📝 Creating indexes...')
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_cli_clients_client_id ON cli_clients(client_id);
      CREATE INDEX IF NOT EXISTS idx_user_cli_permissions_user_id ON user_cli_permissions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_cli_permissions_client_id ON user_cli_permissions(client_id);
      CREATE INDEX IF NOT EXISTS idx_cli_audit_logs_user_id ON cli_audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_cli_audit_logs_client_id ON cli_audit_logs(client_id);
    `
    
    const { error: indexError } = await supabase.rpc('exec_sql', { sql: createIndexes })
    if (indexError) {
      console.error('❌ Failed to create indexes:', indexError)
    } else {
      console.log('✅ Indexes created')
    }
    
    // Enable RLS
    console.log('📝 Enabling Row Level Security...')
    const enableRLS = `
      ALTER TABLE cli_clients ENABLE ROW LEVEL SECURITY;
      ALTER TABLE user_cli_permissions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE cli_audit_logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE cli_rate_limits ENABLE ROW LEVEL SECURITY;
    `
    
    const { error: rlsError } = await supabase.rpc('exec_sql', { sql: enableRLS })
    if (rlsError) {
      console.error('❌ Failed to enable RLS:', rlsError)
    } else {
      console.log('✅ RLS enabled')
    }
    
    // Create basic RLS policies
    console.log('📝 Creating RLS policies...')
    const createPolicies = `
      -- CLI Clients policies
      CREATE POLICY "Users can view their own CLI clients" ON cli_clients
        FOR SELECT USING (auth.uid() = created_by);
      
      CREATE POLICY "Users can create CLI clients" ON cli_clients
        FOR INSERT WITH CHECK (auth.uid() = created_by);
      
      -- User permissions policies
      CREATE POLICY "Users can view their own permissions" ON user_cli_permissions
        FOR SELECT USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can create their own permissions" ON user_cli_permissions
        FOR INSERT WITH CHECK (auth.uid() = user_id);
      
      -- Audit logs policies
      CREATE POLICY "Users can view their own audit logs" ON cli_audit_logs
        FOR SELECT USING (auth.uid() = user_id);
      
      CREATE POLICY "System can create audit logs" ON cli_audit_logs
        FOR INSERT WITH CHECK (true);
      
      -- Rate limits policies
      CREATE POLICY "System can manage rate limits" ON cli_rate_limits
        FOR ALL USING (true);
    `
    
    const { error: policyError } = await supabase.rpc('exec_sql', { sql: createPolicies })
    if (policyError) {
      console.error('❌ Failed to create policies:', policyError)
    } else {
      console.log('✅ RLS policies created')
    }
    
    // Create functions
    console.log('📝 Creating utility functions...')
    const createFunctions = `
      -- Function to generate client credentials
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
    `
    
    const { error: functionError } = await supabase.rpc('exec_sql', { sql: createFunctions })
    if (functionError) {
      console.error('❌ Failed to create functions:', functionError)
    } else {
      console.log('✅ Utility functions created')
    }
    
    console.log('🎉 CLI tables setup completed successfully!')
    return true
    
  } catch (error) {
    console.error('❌ Setup failed:', error)
    return false
  }
}

async function main() {
  const success = await setupCLITables()
  if (success) {
    console.log('\n✅ CLI system is ready!')
    console.log('📊 You can now test the CLI functionality')
  } else {
    console.log('\n❌ Setup failed')
    process.exit(1)
  }
}

main().catch(console.error)
