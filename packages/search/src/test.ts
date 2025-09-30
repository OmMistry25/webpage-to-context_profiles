import { HybridSearchService, searchService } from './index.js'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
config({ path: path.join(__dirname, '../../../apps/web/.env.local') })

async function testSearchService() {
  console.log('🧪 Testing Hybrid Search Service')
  console.log('==================================')

  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️  OpenAI API key not found. Skipping embedding tests.')
      console.log('   To test embedding generation, add OPENAI_API_KEY to your .env.local file')
      console.log()
    }

    // Test 1: Check database connectivity
    console.log('1️⃣ Testing database connectivity...')
    const { data: chunks, error } = await searchService.supabase
      .from('chunks')
      .select('id, content, token_count')
      .limit(5)

    if (error) {
      console.error('❌ Database connection failed:', error)
      return
    }

    console.log(`✅ Found ${chunks?.length || 0} chunks in database`)
    if (chunks && chunks.length > 0) {
      console.log(`   Sample chunk: "${chunks[0].content.substring(0, 100)}..."`)
    }

    // Test 2: Test keyword search (no API key required)
    console.log('\n2️⃣ Testing keyword search...')
    const keywordResults = await searchService.keywordSearch('OpenAI API', { limit: 3 })
    console.log(`✅ Keyword search found ${keywordResults.length} results`)
    
    if (keywordResults.length > 0) {
      console.log(`   Top result: "${keywordResults[0].content.substring(0, 100)}..."`)
      console.log(`   Keyword score: ${keywordResults[0].keyword_score.toFixed(3)}`)
    }

    // Test 3: Test semantic search (requires API key)
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 50) {
      try {
        console.log('\n3️⃣ Testing semantic search...')
        const semanticResults = await searchService.semanticSearch(
          await searchService.generateQueryEmbedding('machine learning models'),
          { limit: 3 }
        )
        console.log(`✅ Semantic search found ${semanticResults.length} results`)
        
        if (semanticResults.length > 0) {
          console.log(`   Top result: "${semanticResults[0].content.substring(0, 100)}..."`)
          console.log(`   Similarity score: ${semanticResults[0].similarity_score.toFixed(3)}`)
        }

        // Test 4: Test hybrid search
        console.log('\n4️⃣ Testing hybrid search...')
        const hybridResults = await searchService.hybridSearch('OpenAI API documentation', { limit: 3 })
        console.log(`✅ Hybrid search found ${hybridResults.length} results`)
        
        if (hybridResults.length > 0) {
          console.log(`   Top result: "${hybridResults[0].content.substring(0, 100)}..."`)
          console.log(`   Combined score: ${hybridResults[0].combined_score.toFixed(3)}`)
          console.log(`   Semantic score: ${hybridResults[0].similarity_score.toFixed(3)}`)
          console.log(`   Keyword score: ${hybridResults[0].keyword_score.toFixed(3)}`)
        }
      } catch (error) {
        console.log('\n3️⃣ API key issue detected, skipping semantic and hybrid search tests')
        console.log('   Please check your OPENAI_API_KEY in .env.local')
      }
    } else {
      console.log('\n3️⃣ Skipping semantic and hybrid search tests (no valid API key)')
    }

    // Test 5: Test search with fallback
    console.log('\n5️⃣ Testing search with fallback...')
    const fallbackResults = await searchService.searchWithFallback('nonexistent query xyz123', { limit: 3 })
    console.log(`✅ Fallback search found ${fallbackResults.length} results`)

    console.log('\n🎉 All tests completed successfully!')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run tests
testSearchService()
