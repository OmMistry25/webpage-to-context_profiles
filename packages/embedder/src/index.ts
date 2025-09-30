import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
config({ path: path.join(__dirname, '../../../apps/web/.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

export interface Chunk {
  id: string
  page_id: string
  content: string
  token_count: number
  chunk_index: number
  embedding?: number[]
  created_at?: string
}

export interface EmbeddingResult {
  chunk_id: string
  embedding: number[]
  success: boolean
  error?: string
}

export class EmbedderService {
  private batchSize: number
  private delayMs: number

  constructor(batchSize: number = 10, delayMs: number = 1000) {
    this.batchSize = batchSize
    this.delayMs = delayMs
  }

  /**
   * Generate embedding for a single text using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const client = getOpenAI()
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      })

      return response.data[0].embedding
    } catch (error) {
      console.error('❌ Error generating embedding:', error)
      throw error
    }
  }

  /**
   * Generate embeddings for multiple texts in a single API call
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const client = getOpenAI()
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
        encoding_format: 'float',
      })

      return response.data.map(item => item.embedding)
    } catch (error) {
      console.error('❌ Error generating embeddings:', error)
      throw error
    }
  }

  /**
   * Get chunks that need embeddings
   */
  async getChunksWithoutEmbeddings(limit: number = 100): Promise<Chunk[]> {
    try {
      const { data: chunks, error } = await supabase
        .from('chunks')
        .select('id, page_id, content, token_count, chunk_index, created_at')
        .is('embedding', null)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (error) {
        console.error('❌ Error fetching chunks:', error)
        throw error
      }

      return chunks || []
    } catch (error) {
      console.error('❌ Error fetching chunks:', error)
      throw error
    }
  }

  /**
   * Update chunk with embedding
   */
  async updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('chunks')
        .update({ embedding })
        .eq('id', chunkId)

      if (error) {
        console.error('❌ Error updating chunk embedding:', error)
        throw error
      }
    } catch (error) {
      console.error('❌ Error updating chunk embedding:', error)
      throw error
    }
  }

  /**
   * Process chunks in batches with rate limiting
   */
  async processChunksBatch(chunks: Chunk[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = []

    for (let i = 0; i < chunks.length; i += this.batchSize) {
      const batch = chunks.slice(i, i + this.batchSize)
      console.log(`🔄 Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(chunks.length / this.batchSize)}`)

      try {
        // Generate embeddings for the batch
        const texts = batch.map(chunk => chunk.content)
        const embeddings = await this.generateEmbeddings(texts)

        // Update each chunk with its embedding
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j]
          const embedding = embeddings[j]

          try {
            await this.updateChunkEmbedding(chunk.id, embedding)
            results.push({
              chunk_id: chunk.id,
              embedding,
              success: true
            })
            console.log(`✅ Embedded chunk ${chunk.id} (${chunk.token_count} tokens)`)
          } catch (error) {
            results.push({
              chunk_id: chunk.id,
              embedding: [],
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
            console.error(`❌ Failed to update chunk ${chunk.id}:`, error)
          }
        }

        // Rate limiting delay
        if (i + this.batchSize < chunks.length) {
          console.log(`⏳ Waiting ${this.delayMs}ms before next batch...`)
          await new Promise(resolve => setTimeout(resolve, this.delayMs))
        }

      } catch (error) {
        console.error(`❌ Batch processing failed:`, error)
        // Mark all chunks in this batch as failed
        for (const chunk of batch) {
          results.push({
            chunk_id: chunk.id,
            embedding: [],
            success: false,
            error: error instanceof Error ? error.message : 'Batch processing failed'
          })
        }
      }
    }

    return results
  }

  /**
   * Process all chunks that need embeddings
   */
  async processAllChunks(): Promise<EmbeddingResult[]> {
    console.log('🚀 Starting embedding process for all chunks')
    console.log('==========================================')

    try {
      // Get chunks that need embeddings
      const chunks = await this.getChunksWithoutEmbeddings(1000) // Process up to 1000 chunks
      
      if (chunks.length === 0) {
        console.log('✅ No chunks need embeddings')
        return []
      }

      console.log(`📊 Found ${chunks.length} chunks that need embeddings`)
      console.log(`📦 Processing in batches of ${this.batchSize}`)
      console.log()

      // Process chunks in batches
      const results = await this.processChunksBatch(chunks)

      // Summary
      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length

      console.log()
      console.log('🎉 Embedding process completed!')
      console.log('===============================')
      console.log(`✅ Successful: ${successful}`)
      console.log(`❌ Failed: ${failed}`)
      console.log(`📊 Total processed: ${results.length}`)

      return results

    } catch (error) {
      console.error('❌ Embedding process failed:', error)
      throw error
    }
  }

  /**
   * Get embedding statistics
   */
  async getEmbeddingStats(): Promise<{
    totalChunks: number
    embeddedChunks: number
    pendingChunks: number
    embeddingRate: number
  }> {
    try {
      const { count: totalChunks, error: totalError } = await supabase
        .from('chunks')
        .select('*', { count: 'exact', head: true })

      if (totalError) throw totalError

      const { count: embeddedChunks, error: embeddedError } = await supabase
        .from('chunks')
        .select('*', { count: 'exact', head: true })
        .not('embedding', 'is', null)

      if (embeddedError) throw embeddedError

      const pendingChunks = (totalChunks || 0) - (embeddedChunks || 0)
      const embeddingRate = totalChunks ? (embeddedChunks || 0) / totalChunks : 0

      return {
        totalChunks: totalChunks || 0,
        embeddedChunks: embeddedChunks || 0,
        pendingChunks,
        embeddingRate: Math.round(embeddingRate * 100) / 100
      }
    } catch (error) {
      console.error('❌ Error getting embedding stats:', error)
      throw error
    }
  }
}

// Export default instance
export const embedder = new EmbedderService()