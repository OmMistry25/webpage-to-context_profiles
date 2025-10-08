const axios = require('axios')

const API_BASE_URL = 'http://localhost:3000'

async function testCLIAPI() {
  console.log('🧪 Testing CLI API endpoints...\n')

  try {
    // Test 1: CLI Registration
    console.log('1️⃣ Testing CLI client registration...')
    try {
      const registerResponse = await axios.post(`${API_BASE_URL}/api/cli/auth/register`, {
        name: 'Test CLI Client',
        description: 'Test client for CLI API',
        redirectUri: 'http://localhost:8080/callback',
        scopes: ['read:projects', 'read:crawls', 'search:chunks', 'export:data']
      })
      console.log('✅ Registration successful:', registerResponse.data.client.name)
    } catch (error) {
      console.log('❌ Registration failed:', error.response?.data?.error || error.message)
    }

    // Test 2: Token Request
    console.log('\n2️⃣ Testing token request...')
    try {
      const tokenResponse = await axios.post(`${API_BASE_URL}/api/cli/auth/token`, {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        code: 'test-auth-code',
        grantType: 'authorization_code'
      })
      console.log('✅ Token request successful:', tokenResponse.data.token_type)
    } catch (error) {
      console.log('❌ Token request failed:', error.response?.data?.error || error.message)
    }

    // Test 3: Permission Grant
    console.log('\n3️⃣ Testing permission grant...')
    try {
      const permissionResponse = await axios.post(`${API_BASE_URL}/api/cli/auth/permissions`, {
        userId: 'test-user-id',
        clientId: 'test-client-id',
        scopes: ['read:projects', 'search:chunks'],
        filters: {},
        expiresIn: 3600
      })
      console.log('✅ Permission grant successful:', permissionResponse.data.permission.id)
    } catch (error) {
      console.log('❌ Permission grant failed:', error.response?.data?.error || error.message)
    }

    // Test 4: Search API
    console.log('\n4️⃣ Testing search API...')
    try {
      const searchResponse = await axios.post(`${API_BASE_URL}/api/cli/search`, {
        query: 'test query',
        userId: 'test-user-id',
        scope: 'all',
        limit: 10
      }, {
        headers: {
          'Authorization': 'Bearer test-client-id:test-token'
        }
      })
      console.log('✅ Search successful:', searchResponse.data.results.length, 'results')
    } catch (error) {
      console.log('❌ Search failed:', error.response?.data?.error || error.message)
    }

    // Test 5: Projects List
    console.log('\n5️⃣ Testing projects list...')
    try {
      const projectsResponse = await axios.get(`${API_BASE_URL}/api/cli/projects?userId=test-user-id`, {
        headers: {
          'Authorization': 'Bearer test-client-id:test-token'
        }
      })
      console.log('✅ Projects list successful:', projectsResponse.data.projects.length, 'projects')
    } catch (error) {
      console.log('❌ Projects list failed:', error.response?.data?.error || error.message)
    }

    // Test 6: Crawls List
    console.log('\n6️⃣ Testing crawls list...')
    try {
      const crawlsResponse = await axios.get(`${API_BASE_URL}/api/cli/crawls?userId=test-user-id`, {
        headers: {
          'Authorization': 'Bearer test-client-id:test-token'
        }
      })
      console.log('✅ Crawls list successful:', crawlsResponse.data.crawls.length, 'crawls')
    } catch (error) {
      console.log('❌ Crawls list failed:', error.response?.data?.error || error.message)
    }

    // Test 7: Export API
    console.log('\n7️⃣ Testing export API...')
    try {
      const exportResponse = await axios.post(`${API_BASE_URL}/api/cli/export`, {
        resourceType: 'project',
        resourceId: 'test-project-id',
        userId: 'test-user-id',
        format: 'zip'
      }, {
        headers: {
          'Authorization': 'Bearer test-client-id:test-token'
        }
      })
      console.log('✅ Export successful:', exportResponse.data.downloadUrl)
    } catch (error) {
      console.log('❌ Export failed:', error.response?.data?.error || error.message)
    }

    console.log('\n🎉 CLI API testing completed!')
    console.log('\n📝 Note: Some tests may fail due to missing database tables.')
    console.log('   This is expected until we run the database migration.')

  } catch (error) {
    console.error('❌ Test suite failed:', error.message)
  }
}

// Check if web app is running
async function checkWebApp() {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/health`, { timeout: 5000 })
    console.log('✅ Web app is running')
    return true
  } catch (error) {
    console.log('❌ Web app is not running. Please start it with: npm run dev')
    return false
  }
}

async function main() {
  console.log('🔍 Checking if web app is running...')
  const isRunning = await checkWebApp()
  
  if (isRunning) {
    await testCLIAPI()
  } else {
    console.log('\n💡 To start the web app:')
    console.log('   cd apps/web && npm run dev')
  }
}

main().catch(console.error)
