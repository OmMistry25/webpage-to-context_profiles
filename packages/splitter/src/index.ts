import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
config({ path: path.join(__dirname, '../../../apps/web/.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface Chunk {
  id?: string
  page_id: string
  content: string
  token_count: number
  chunk_index: number
  start_char?: number
  end_char?: number
  created_at?: string
}

export interface SplitterOptions {
  maxTokens: number
  overlapTokens: number
  minTokens: number
}

export class TokenAwareSplitter {
  private options: SplitterOptions

  constructor(options: Partial<SplitterOptions> = {}) {
    this.options = {
      maxTokens: 1000,      // Max tokens per chunk
      overlapTokens: 100,   // Overlap between chunks
      minTokens: 50,        // Minimum tokens per chunk
      ...options
    }
  }

  /**
   * Estimate token count using a simple approximation
   * 1 token ≈ 4 characters for English text
   */
  private estimateTokens(text: string): number {
    // Remove extra whitespace and count characters
    const cleanText = text.replace(/\s+/g, ' ').trim()
    return Math.ceil(cleanText.length / 4)
  }

  /**
   * Split text into chunks at natural boundaries
   */
  private splitAtBoundaries(text: string, maxTokens: number): string[] {
    const sentences = text.split(/(?<=[.!?])\s+/)
    const chunks: string[] = []
    let currentChunk = ''

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence)
      const currentTokens = this.estimateTokens(currentChunk)
      
      // If adding this sentence would exceed the limit, start a new chunk
      if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = sentence
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim())
    }

    return chunks
  }

  /**
   * Create overlapping chunks from text
   */
  public splitText(text: string): Chunk[] {
    if (!text || text.trim().length === 0) {
      return []
    }

    const chunks: Chunk[] = []
    const initialChunks = this.splitAtBoundaries(text, this.options.maxTokens)
    
    for (let i = 0; i < initialChunks.length; i++) {
      const chunk = initialChunks[i]
      const tokenCount = this.estimateTokens(chunk)
      
      // Skip chunks that are too small
      if (tokenCount < this.options.minTokens) {
        continue
      }

      // Calculate character positions
      const startChar = text.indexOf(chunk)
      const endChar = startChar + chunk.length

      chunks.push({
        content: chunk,
        token_count: tokenCount,
        chunk_index: i,
        start_char: startChar >= 0 ? startChar : undefined,
        end_char: endChar >= 0 ? endChar : undefined,
        page_id: '' // Will be set when saving
      })
    }

    // Add overlap between chunks
    return this.addOverlap(chunks, text)
  }

  /**
   * Add overlap between chunks to maintain context
   */
  private addOverlap(chunks: Chunk[], originalText: string): Chunk[] {
    if (chunks.length <= 1) {
      return chunks
    }

    const overlappedChunks: Chunk[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = { ...chunks[i] }
      
      // Add overlap from previous chunk
      if (i > 0) {
        const prevChunk = chunks[i - 1]
        const overlapStart = Math.max(0, prevChunk.end_char - this.options.overlapTokens * 4)
        const overlapText = originalText.slice(overlapStart, prevChunk.end_char)
        
        if (overlapText.trim().length > 0) {
          chunk.content = overlapText + ' ' + chunk.content
          chunk.start_char = overlapStart
          chunk.token_count = this.estimateTokens(chunk.content)
        }
      }

      // Add overlap to next chunk
      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1]
        const overlapEnd = Math.min(originalText.length, chunk.end_char + this.options.overlapTokens * 4)
        const overlapText = originalText.slice(chunk.end_char, overlapEnd)
        
        if (overlapText.trim().length > 0) {
          chunk.content = chunk.content + ' ' + overlapText
          chunk.end_char = overlapEnd
          chunk.token_count = this.estimateTokens(chunk.content)
        }
      }

      overlappedChunks.push(chunk)
    }

    return overlappedChunks
  }

  /**
   * Process a page and create chunks
   */
  public async processPage(pageId: string): Promise<Chunk[]> {
    try {
      // Fetch the page data
      const { data: page, error: pageError } = await supabase
        .from('pages')
        .select('id, title, markdown_path, url')
        .eq('id', pageId)
        .single()

      if (pageError || !page) {
        console.error(`❌ Error fetching page ${pageId}:`, pageError)
        return []
      }

      // Download the markdown content
      if (!page.markdown_path) {
        console.log(`⏭️  No markdown content for page ${pageId}`)
        return []
      }

      const { data: markdownData, error: downloadError } = await supabase.storage
        .from('crawl_data')
        .download(page.markdown_path)

      if (downloadError || !markdownData) {
        console.error(`❌ Error downloading markdown for page ${pageId}:`, downloadError)
        return []
      }

      const markdownText = await markdownData.text()
      
      // Split the text into chunks
      const chunks = this.splitText(markdownText)
      
      // Add page_id to each chunk
      const chunksWithPageId = chunks.map(chunk => ({
        ...chunk,
        page_id: pageId
      }))

      console.log(`📄 Processed page "${page.title}" (${page.url})`)
      console.log(`   Created ${chunksWithPageId.length} chunks`)
      console.log(`   Total tokens: ${chunksWithPageId.reduce((sum, chunk) => sum + chunk.token_count, 0)}`)

      return chunksWithPageId

    } catch (error) {
      console.error(`❌ Error processing page ${pageId}:`, error)
      return []
    }
  }

  /**
   * Save chunks to the database
   */
  public async saveChunks(chunks: Chunk[]): Promise<void> {
    if (chunks.length === 0) {
      return
    }

    try {
      // Only save the fields that exist in the current schema
      const chunksToSave = chunks.map(chunk => ({
        page_id: chunk.page_id,
        content: chunk.content,
        token_count: chunk.token_count,
        chunk_index: chunk.chunk_index
      }))

      const { error } = await supabase
        .from('chunks')
        .insert(chunksToSave)

      if (error) {
        console.error('❌ Error saving chunks:', error)
        throw error
      }

      console.log(`✅ Saved ${chunks.length} chunks to database`)

    } catch (error) {
      console.error('❌ Error saving chunks:', error)
      throw error
    }
  }

  /**
   * Process all pages for a crawl
   */
  public async processCrawl(crawlId: string): Promise<void> {
    try {
      console.log(`🔄 Processing crawl ${crawlId} for chunking...`)

      // Get all pages for this crawl
      const { data: pages, error: pagesError } = await supabase
        .from('pages')
        .select('id, title, url')
        .eq('crawl_id', crawlId)
        .order('created_at', { ascending: true })

      if (pagesError) {
        console.error('❌ Error fetching pages:', pagesError)
        return
      }

      if (!pages || pages.length === 0) {
        console.log('⏭️  No pages found for this crawl')
        return
      }

      console.log(`📊 Found ${pages.length} pages to process`)

      let totalChunks = 0
      let processedPages = 0

      for (const page of pages) {
        try {
          const chunks = await this.processPage(page.id)
          
          if (chunks.length > 0) {
            await this.saveChunks(chunks)
            totalChunks += chunks.length
          }
          
          processedPages++
          console.log(`✅ Processed ${processedPages}/${pages.length} pages`)

        } catch (error) {
          console.error(`❌ Error processing page ${page.id}:`, error)
        }
      }

      console.log(`🎉 Chunking completed for crawl ${crawlId}`)
      console.log(`   Processed: ${processedPages}/${pages.length} pages`)
      console.log(`   Created: ${totalChunks} chunks`)

    } catch (error) {
      console.error(`❌ Error processing crawl ${crawlId}:`, error)
      throw error
    }
  }
}

// Export for use in other packages
export default TokenAwareSplitter
