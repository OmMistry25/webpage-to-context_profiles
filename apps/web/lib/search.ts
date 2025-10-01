import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

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

export interface SearchResult {
  id: string
  page_id: string
  content: string
  token_count: number
  chunk_index: number
  similarity_score: number
  keyword_score: number
  combined_score: number
  page_title?: string
  page_url?: string
  crawl_id?: string
}

export interface SearchOptions {
  limit?: number
  semanticWeight?: number
  keywordWeight?: number
  minSimilarity?: number
  projectId?: string
}

export class HybridSearchService {
  private semanticWeight: number
  private keywordWeight: number

  constructor(semanticWeight: number = 0.7, keywordWeight: number = 0.3) {
    this.semanticWeight = semanticWeight
    this.keywordWeight = keywordWeight
  }

  /**
   * Generate embedding for search query
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      const client = getOpenAI()
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
        encoding_format: 'float',
      })

      return response.data[0].embedding
    } catch (error) {
      console.error('❌ Error generating query embedding:', error)
      throw error
    }
  }

  /**
   * Perform semantic search using vector similarity
   */
  async semanticSearch(
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      const { limit = 20, minSimilarity = 0.01, projectId } = options

      let query = supabase
        .from('chunks')
        .select(`
          id,
          page_id,
          content,
          token_count,
          chunk_index,
          embedding,
          pages!inner(
            title,
            url,
            crawl_id,
            crawls!inner(
              project_id
            )
          )
        `)
        .not('embedding', 'is', null)

      // Filter by project if specified
      if (projectId) {
        query = query.eq('pages.crawls.project_id', projectId)
      }

      const { data: chunks, error } = await query

      if (error) {
        console.error('❌ Error fetching chunks for semantic search:', error)
        throw error
      }

      if (!chunks || chunks.length === 0) {
        return []
      }

      // Calculate cosine similarity for each chunk
      const results: SearchResult[] = chunks
        .filter((chunk: any) => chunk.embedding && Array.isArray(chunk.embedding) && chunk.embedding.length === queryEmbedding.length)
        .map((chunk: any) => {
          const similarity = this.calculateCosineSimilarity(
            queryEmbedding,
            chunk.embedding
          )

          return {
            id: chunk.id,
            page_id: chunk.page_id,
            content: chunk.content,
            token_count: chunk.token_count,
            chunk_index: chunk.chunk_index,
            similarity_score: similarity,
            keyword_score: 0, // Will be calculated in hybrid search
            combined_score: similarity,
            page_title: chunk.pages?.title,
            page_url: chunk.pages?.url,
            crawl_id: chunk.pages?.crawl_id
          }
        })
        .filter((result: SearchResult) => result.similarity_score >= minSimilarity)
        .sort((a: SearchResult, b: SearchResult) => b.similarity_score - a.similarity_score)
        .slice(0, limit)

      return results

    } catch (error) {
      console.error('❌ Error in semantic search:', error)
      throw error
    }
  }

  /**
   * Perform keyword search using full-text search
   */
  async keywordSearch(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      const { limit = 20, projectId } = options

      let queryBuilder = supabase
        .from('chunks')
        .select(`
          id,
          page_id,
          content,
          token_count,
          chunk_index,
          pages!inner(
            title,
            url,
            crawl_id,
            crawls!inner(
              project_id
            )
          )
        `)
        .textSearch('content', query, {
          type: 'websearch',
          config: 'english'
        })

      // Filter by project if specified
      if (projectId) {
        queryBuilder = queryBuilder.eq('pages.crawls.project_id', projectId)
      }

      const { data: chunks, error } = await queryBuilder.limit(limit)

      if (error) {
        console.error('❌ Error in keyword search:', error)
        throw error
      }

      if (!chunks || chunks.length === 0) {
        return []
      }

      // Calculate keyword relevance score based on term frequency
      const results: SearchResult[] = chunks.map((chunk: any) => {
        const keywordScore = this.calculateKeywordScore(query, chunk.content)

        return {
          id: chunk.id,
          page_id: chunk.page_id,
          content: chunk.content,
          token_count: chunk.token_count,
          chunk_index: chunk.chunk_index,
          similarity_score: 0, // Will be calculated in hybrid search
          keyword_score: keywordScore,
          combined_score: keywordScore,
          page_title: chunk.pages?.title,
          page_url: chunk.pages?.url,
          crawl_id: chunk.pages?.crawl_id
        }
      })

      return results

    } catch (error) {
      console.error('❌ Error in keyword search:', error)
      throw error
    }
  }

  /**
   * Perform hybrid search combining semantic and keyword search
   */
  async hybridSearch(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      console.log(`🔍 Performing hybrid search for: "${query}"`)
      
      // Generate query embedding for semantic search
      const queryEmbedding = await this.generateQueryEmbedding(query)
      console.log(`✅ Generated query embedding (${queryEmbedding.length} dimensions)`)

      // Perform both searches in parallel
      const [semanticResults, keywordResults] = await Promise.all([
        this.semanticSearch(queryEmbedding, options),
        this.keywordSearch(query, options)
      ])

      console.log(`📊 Semantic results: ${semanticResults.length}`)
      console.log(`📊 Keyword results: ${keywordResults.length}`)

      // Combine and deduplicate results
      const combinedResults = this.combineSearchResults(
        semanticResults,
        keywordResults,
        options
      )

      console.log(`🎯 Final results: ${combinedResults.length}`)
      return combinedResults

    } catch (error) {
      console.error('❌ Error in hybrid search:', error)
      throw error
    }
  }

  /**
   * Combine semantic and keyword search results
   */
  private combineSearchResults(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[],
    options: SearchOptions
  ): SearchResult[] {
    const { limit = 20, semanticWeight = this.semanticWeight, keywordWeight = this.keywordWeight } = options

    // Create a map to store combined results
    const resultMap = new Map<string, SearchResult>()

    // Add semantic results
    semanticResults.forEach(result => {
      resultMap.set(result.id, {
        ...result,
        keyword_score: 0,
        combined_score: result.similarity_score * semanticWeight
      })
    })

    // Add keyword results and combine scores
    keywordResults.forEach(result => {
      const existing = resultMap.get(result.id)
      if (existing) {
        // Combine scores for existing result
        existing.keyword_score = result.keyword_score
        existing.combined_score = 
          (existing.similarity_score * semanticWeight) + 
          (result.keyword_score * keywordWeight)
      } else {
        // Add new result
        resultMap.set(result.id, {
          ...result,
          similarity_score: 0,
          combined_score: result.keyword_score * keywordWeight
        })
      }
    })

    // Convert to array and sort by combined score
    const combinedResults = Array.from(resultMap.values())
      .sort((a, b) => b.combined_score - a.combined_score)
      .slice(0, limit)

    return combinedResults
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i]
      normA += vectorA[i] * vectorA[i]
      normB += vectorB[i] * vectorB[i]
    }

    normA = Math.sqrt(normA)
    normB = Math.sqrt(normB)

    if (normA === 0 || normB === 0) {
      return 0
    }

    return dotProduct / (normA * normB)
  }

  /**
   * Calculate keyword relevance score based on term frequency
   */
  private calculateKeywordScore(query: string, content: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2)
    const contentLower = content.toLowerCase()
    
    if (queryTerms.length === 0) {
      return 0
    }

    let totalScore = 0
    let matchedTerms = 0

    queryTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi')
      const matches = contentLower.match(regex)
      if (matches) {
        matchedTerms++
        // Score based on term frequency and term length
        totalScore += (matches.length * term.length) / 100
      }
    })

    // Normalize score based on matched terms and content length
    const normalizedScore = matchedTerms > 0 
      ? (totalScore * matchedTerms) / queryTerms.length
      : 0

    return Math.min(normalizedScore, 1) // Cap at 1.0
  }

  /**
   * Search with fallback (semantic first, then keyword if no results)
   */
  async searchWithFallback(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      // Try hybrid search first
      const results = await this.hybridSearch(query, options)
      
      if (results.length > 0) {
        return results
      }

      // Fallback to keyword-only search
      console.log('🔄 No hybrid results, falling back to keyword search...')
      return await this.keywordSearch(query, options)

    } catch (error) {
      console.error('❌ Error in search with fallback:', error)
      throw error
    }
  }
}
