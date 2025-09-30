import { embedder } from './index.js'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
config({ path: path.join(__dirname, '../../../apps/web/.env.local') })

async function testEmbedder() {
  console.log('🧪 Testing Embedder Service')
  console.log('===========================')

  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️  OpenAI API key not found. Skipping embedding generation tests.')
      console.log('   To test embedding generation, add OPENAI_API_KEY to your .env.local file')
      console.log()
    } else {
      // Test single embedding generation
      console.log('1. Testing single embedding generation...')
      const testText = "This is a test chunk for embedding generation."
      const embedding = await embedder.generateEmbedding(testText)
      console.log(`✅ Generated embedding with ${embedding.length} dimensions`)
      console.log(`   First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)
      console.log()

      // Test multiple embeddings
      console.log('2. Testing batch embedding generation...')
      const testTexts = [
        "First test chunk about machine learning.",
        "Second test chunk about web development.",
        "Third test chunk about data science."
      ]
      const embeddings = await embedder.generateEmbeddings(testTexts)
      console.log(`✅ Generated ${embeddings.length} embeddings`)
      embeddings.forEach((emb, i) => {
        console.log(`   Embedding ${i + 1}: ${emb.length} dimensions`)
      })
      console.log()
    }

    // Get embedding statistics
    console.log('3. Getting embedding statistics...')
    const stats = await embedder.getEmbeddingStats()
    console.log('📊 Embedding Statistics:')
    console.log(`   Total chunks: ${stats.totalChunks}`)
    console.log(`   Embedded chunks: ${stats.embeddedChunks}`)
    console.log(`   Pending chunks: ${stats.pendingChunks}`)
    console.log(`   Embedding rate: ${(stats.embeddingRate * 100).toFixed(1)}%`)
    console.log()

    // Get chunks without embeddings
    console.log('4. Getting chunks without embeddings...')
    const chunksWithoutEmbeddings = await embedder.getChunksWithoutEmbeddings(5)
    console.log(`📄 Found ${chunksWithoutEmbeddings.length} chunks without embeddings`)
    
    if (chunksWithoutEmbeddings.length > 0) {
      console.log('Sample chunks:')
      chunksWithoutEmbeddings.slice(0, 3).forEach((chunk, i) => {
        console.log(`   ${i + 1}. Chunk ${chunk.id}: ${chunk.token_count} tokens`)
        console.log(`      Content: "${chunk.content.substring(0, 100)}..."`)
      })
    }

    console.log()
    console.log('✅ All tests completed successfully!')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testEmbedder().catch(console.error)
