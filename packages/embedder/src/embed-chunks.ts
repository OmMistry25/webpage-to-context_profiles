import { embedder } from './index.js'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
config({ path: path.join(__dirname, '../../../apps/web/.env.local') })

async function embedAllChunks() {
  console.log('🚀 Starting Embedding Process')
  console.log('==============================')

  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log('❌ OpenAI API key not found!')
      console.log('   Please add OPENAI_API_KEY to your .env.local file')
      console.log('   You can get an API key from: https://platform.openai.com/api-keys')
      process.exit(1)
    }

    // Get initial statistics
    const initialStats = await embedder.getEmbeddingStats()
    console.log('📊 Initial Statistics:')
    console.log(`   Total chunks: ${initialStats.totalChunks}`)
    console.log(`   Already embedded: ${initialStats.embeddedChunks}`)
    console.log(`   Pending: ${initialStats.pendingChunks}`)
    console.log()

    if (initialStats.pendingChunks === 0) {
      console.log('✅ All chunks already have embeddings!')
      return
    }

    // Process all chunks
    const results = await embedder.processAllChunks()

    // Final statistics
    const finalStats = await embedder.getEmbeddingStats()
    console.log()
    console.log('📊 Final Statistics:')
    console.log(`   Total chunks: ${finalStats.totalChunks}`)
    console.log(`   Embedded chunks: ${finalStats.embeddedChunks}`)
    console.log(`   Pending chunks: ${finalStats.pendingChunks}`)
    console.log(`   Embedding rate: ${(finalStats.embeddingRate * 100).toFixed(1)}%`)

    // Show failed chunks if any
    const failedResults = results.filter(r => !r.success)
    if (failedResults.length > 0) {
      console.log()
      console.log('❌ Failed chunks:')
      failedResults.forEach(result => {
        console.log(`   Chunk ${result.chunk_id}: ${result.error}`)
      })
    }

    console.log()
    console.log('🎉 Embedding process completed!')

  } catch (error) {
    console.error('❌ Embedding process failed:', error)
    process.exit(1)
  }
}

embedAllChunks().catch(console.error)
