import { bundlerService } from './index.js'

async function testBundler() {
  console.log('🧪 Testing Bundler Service')
  console.log('==========================')

  try {
    // Test with a real project ID from your database
    const projectId = 'b9dcddea-707c-49f1-88ae-4a5d98442658' // Replace with actual project ID
    
    console.log(`📦 Creating bundle for project: ${projectId}`)
    
    const result = await bundlerService.createBundle(projectId)
    
    console.log('✅ Bundle created successfully!')
    console.log('Bundle ID:', result.bundleId)
    console.log('Download URL:', result.downloadUrl)
    
  } catch (error) {
    console.error('❌ Bundle creation failed:', error)
  }
}

testBundler()
