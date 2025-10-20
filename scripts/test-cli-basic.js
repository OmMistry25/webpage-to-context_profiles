const axios = require('axios')

const API_BASE_URL = 'http://localhost:3001'

async function testBasicCLI() {
  console.log('🧪 Testing basic CLI functionality...\n')

  try {
    // Test 1: Check if web app is running
    console.log('1️⃣ Testing web app connectivity...')
    try {
      const healthResponse = await axios.get(`${API_BASE_URL}/api/health`, { timeout: 5000 })
      console.log('✅ Web app is running')
    } catch (error) {
      console.log('❌ Web app is not running')
      return
    }

    // Test 2: Check if we have existing projects
    console.log('\n2️⃣ Checking existing projects...')
    try {
      const projectsResponse = await axios.get(`${API_BASE_URL}/api/projects`)
      if (projectsResponse.data && projectsResponse.data.length > 0) {
        console.log('✅ Found', projectsResponse.data.length, 'existing projects')
        console.log('📁 Sample project:', projectsResponse.data[0].name)
        console.log('👤 Owner:', projectsResponse.data[0].owner)
      } else {
        console.log('❌ No projects found. Please create a project first.')
        return
      }
    } catch (error) {
      console.log('❌ Failed to get projects:', error.response?.data?.error || error.message)
      return
    }

    // Test 3: Test CLI endpoints (they should return proper errors)
    console.log('\n3️⃣ Testing CLI endpoints...')
    
    // Test registration endpoint
    try {
      const registerResponse = await axios.post(`${API_BASE_URL}/api/cli/auth/register`, {
        name: 'Test CLI Client',
        description: 'Test client',
        redirectUri: 'http://localhost:8080/callback',
        scopes: ['read:projects']
      })
      console.log('✅ Registration endpoint working')
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Registration endpoint working (returns 401 as expected)')
      } else {
        console.log('❌ Registration endpoint error:', error.response?.data?.error || error.message)
      }
    }

    // Test search endpoint
    try {
      const searchResponse = await axios.post(`${API_BASE_URL}/api/cli/search`, {
        query: 'test',
        userId: 'test-user',
        scope: 'all'
      })
      console.log('✅ Search endpoint working')
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 429) {
        console.log('✅ Search endpoint working (returns expected error)')
      } else {
        console.log('❌ Search endpoint error:', error.response?.data?.error || error.message)
      }
    }

    // Test projects endpoint
    try {
      const projectsResponse = await axios.get(`${API_BASE_URL}/api/cli/projects?userId=test-user`)
      console.log('✅ Projects endpoint working')
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 429) {
        console.log('✅ Projects endpoint working (returns expected error)')
      } else {
        console.log('❌ Projects endpoint error:', error.response?.data?.error || error.message)
      }
    }

    // Test export endpoint
    try {
      const exportResponse = await axios.post(`${API_BASE_URL}/api/cli/export`, {
        resourceType: 'project',
        resourceId: 'test-id',
        userId: 'test-user',
        format: 'zip'
      })
      console.log('✅ Export endpoint working')
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 429) {
        console.log('✅ Export endpoint working (returns expected error)')
      } else {
        console.log('❌ Export endpoint error:', error.response?.data?.error || error.message)
      }
    }

    console.log('\n🎉 Basic CLI testing completed!')
    console.log('\n📝 Next steps:')
    console.log('1. Run the database migration (see scripts/migration-instructions.md)')
    console.log('2. Test with real data using: node scripts/test-cli-with-real-data.js')
    console.log('3. Test the CLI package: cd packages/cli && node dist/index.js --help')

  } catch (error) {
    console.error('❌ Test suite failed:', error.message)
  }
}

async function main() {
  await testBasicCLI()
}

main().catch(console.error)
