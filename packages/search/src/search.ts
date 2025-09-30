import { searchService } from './index.js'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
config({ path: path.join(__dirname, '../../../apps/web/.env.local') })

async function performSearch() {
  console.log('🔍 Interactive Search Demo')
  console.log('==========================')

  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log('❌ OpenAI API key not found!')
      console.log('   Please add OPENAI_API_KEY to your .env.local file')
      console.log('   You can get an API key from: https://platform.openai.com/api-keys')
      process.exit(1)
    }

    // Get search query from command line arguments
    const query = process.argv[2]
    if (!query) {
      console.log('Usage: npm run search "your search query"')
      console.log('Example: npm run search "OpenAI API documentation"')
      process.exit(1)
    }

    console.log(`🔍 Searching for: "${query}"`)
    console.log()

    // Perform hybrid search
    const results = await searchService.hybridSearch(query, { limit: 5 })

    if (results.length === 0) {
      console.log('❌ No results found')
      return
    }

    console.log(`✅ Found ${results.length} results:`)
    console.log()

    // Display results
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.page_title || 'Untitled'}`)
      console.log(`   URL: ${result.page_url || 'N/A'}`)
      console.log(`   Combined Score: ${result.combined_score.toFixed(3)}`)
      console.log(`   Semantic Score: ${result.similarity_score.toFixed(3)}`)
      console.log(`   Keyword Score: ${result.keyword_score.toFixed(3)}`)
      console.log(`   Content: "${result.content.substring(0, 150)}..."`)
      console.log()
    })

    // Show search statistics
    const avgSemanticScore = results.reduce((sum, r) => sum + r.similarity_score, 0) / results.length
    const avgKeywordScore = results.reduce((sum, r) => sum + r.keyword_score, 0) / results.length
    const avgCombinedScore = results.reduce((sum, r) => sum + r.combined_score, 0) / results.length

    console.log('📊 Search Statistics:')
    console.log(`   Average Semantic Score: ${avgSemanticScore.toFixed(3)}`)
    console.log(`   Average Keyword Score: ${avgKeywordScore.toFixed(3)}`)
    console.log(`   Average Combined Score: ${avgCombinedScore.toFixed(3)}`)

  } catch (error) {
    console.error('❌ Search failed:', error)
    process.exit(1)
  }
}

// Run search
performSearch()
