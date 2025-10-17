const axios = require('axios')

const API_BASE_URL = 'http://localhost:3000'

async function testCLIWithRealData() {
  console.log('🧪 Testing CLI API with real data...\n')

  try {
    // First, let's get a real user ID from the existing projects
    console.log('1️⃣ Getting real user data...')
    try {
      const projectsResponse = await axios.get(`${API_BASE_URL}/api/projects`)
      if (projectsResponse.data && projectsResponse.data.length > 0) {
        const realUserId = projectsResponse.data[0].owner
        const realProjectId = projectsResponse.data[0].id
        console.log('✅ Found real user:', realUserId)
        console.log('✅ Found real project:', realProjectId)
        
        // Test CLI registration with real user
        console.log('\n2️⃣ Testing CLI client registration...')
        try {
          const registerResponse = await axios.post(`${API_BASE_URL}/api/cli/auth/register`, {
            name: 'Real Test CLI Client',
            description: 'Test client for CLI API with real data',
            redirectUri: 'http://localhost:8080/callback',
            scopes: ['read:projects', 'read:crawls', 'search:chunks', 'export:data']
          })
          console.log('✅ Registration successful:', registerResponse.data.client.name)
          console.log('📋 Client ID:', registerResponse.data.client.clientId)
          
          const clientId = registerResponse.data.client.clientId
          const clientSecret = registerResponse.data.client.clientSecret
          
          // Test permission grant
          console.log('\n3️⃣ Testing permission grant...')
          try {
            const permissionResponse = await axios.post(`${API_BASE_URL}/api/cli/auth/permissions`, {
              userId: realUserId,
              clientId: clientId,
              scopes: ['read:projects', 'read:crawls', 'search:chunks', 'export:data'],
              filters: {
                projectIds: [realProjectId]
              },
              expiresIn: 3600
            })
            console.log('✅ Permission granted:', permissionResponse.data.permission.id)
            
            // Test search with real data
            console.log('\n4️⃣ Testing search with real data...')
            try {
              const searchResponse = await axios.post(`${API_BASE_URL}/api/cli/search`, {
                query: 'test',
                userId: realUserId,
                scope: 'all',
                limit: 5
              }, {
                headers: {
                  'Authorization': `Bearer ${clientId}:test-token`
                }
              })
              console.log('✅ Search successful:', searchResponse.data.results.length, 'results')
              if (searchResponse.data.results.length > 0) {
                console.log('📄 Sample result:', searchResponse.data.results[0].type)
              }
            } catch (error) {
              console.log('❌ Search failed:', error.response?.data?.error || error.message)
            }
            
            // Test projects list
            console.log('\n5️⃣ Testing projects list...')
            try {
              const projectsListResponse = await axios.get(`${API_BASE_URL}/api/cli/projects?userId=${realUserId}`, {
                headers: {
                  'Authorization': `Bearer ${clientId}:test-token`
                }
              })
              console.log('✅ Projects list successful:', projectsListResponse.data.projects.length, 'projects')
              if (projectsListResponse.data.projects.length > 0) {
                console.log('📁 Sample project:', projectsListResponse.data.projects[0].name)
              }
            } catch (error) {
              console.log('❌ Projects list failed:', error.response?.data?.error || error.message)
            }
            
            // Test crawls list
            console.log('\n6️⃣ Testing crawls list...')
            try {
              const crawlsListResponse = await axios.get(`${API_BASE_URL}/api/cli/crawls?userId=${realUserId}`, {
                headers: {
                  'Authorization': `Bearer ${clientId}:test-token`
                }
              })
              console.log('✅ Crawls list successful:', crawlsListResponse.data.crawls.length, 'crawls')
              if (crawlsListResponse.data.crawls.length > 0) {
                console.log('🕷️ Sample crawl:', crawlsListResponse.data.crawls[0].rootUrl)
              }
            } catch (error) {
              console.log('❌ Crawls list failed:', error.response?.data?.error || error.message)
            }
            
            // Test export
            console.log('\n7️⃣ Testing export...')
            try {
              const exportResponse = await axios.post(`${API_BASE_URL}/api/cli/export`, {
                resourceType: 'project',
                resourceId: realProjectId,
                userId: realUserId,
                format: 'zip'
              }, {
                headers: {
                  'Authorization': `Bearer ${clientId}:test-token`
                }
              })
              console.log('✅ Export successful:', exportResponse.data.downloadUrl)
            } catch (error) {
              console.log('❌ Export failed:', error.response?.data?.error || error.message)
            }
            
          } catch (error) {
            console.log('❌ Permission grant failed:', error.response?.data?.error || error.message)
          }
          
        } catch (error) {
          console.log('❌ Registration failed:', error.response?.data?.error || error.message)
        }
        
      } else {
        console.log('❌ No projects found. Please create a project first.')
      }
    } catch (error) {
      console.log('❌ Failed to get real user data:', error.response?.data?.error || error.message)
    }

    console.log('\n🎉 CLI API testing with real data completed!')

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
    await testCLIWithRealData()
  } else {
    console.log('\n💡 To start the web app:')
    console.log('   cd apps/web && npm run dev')
  }
}

main().catch(console.error)
