import { createClientWithAuth } from '../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { HybridSearchService } from '../../../lib/search'
import OpenAI from 'openai'

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

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: Array<{
    title: string
    url: string
    content: string
    score: number
  }>
}

interface ChatRequest {
  message: string
  projectId?: string
  conversationHistory?: ChatMessage[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClientWithAuth(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: ChatRequest = await request.json()
    const { message, projectId, conversationHistory = [] } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      )
    }

    console.log(`💬 Chat request: "${message}"`)

    // Step 1: Use hybrid search to find relevant content
    const searchService = new HybridSearchService(0.7, 0.3)
    const searchResults = await searchService.searchWithFallback(message, {
      limit: 5,
      projectId
    })

    console.log(`🔍 Found ${searchResults.length} relevant chunks`)

    if (searchResults.length === 0) {
      return NextResponse.json({
        message: "I couldn't find any relevant information in your knowledge base to answer that question. Try asking about something that might be covered in your crawled content.",
        sources: [],
        conversationHistory: [
          ...conversationHistory,
          {
            role: 'user' as const,
            content: message,
            timestamp: new Date().toISOString()
          },
          {
            role: 'assistant' as const,
            content: "I couldn't find any relevant information in your knowledge base to answer that question. Try asking about something that might be covered in your crawled content.",
            timestamp: new Date().toISOString(),
            sources: []
          }
        ]
      })
    }

    // Step 2: Prepare context for AI
    const context = searchResults.map((result, index) => 
      `[Source ${index + 1}] ${result.page_title || 'Untitled'}\nURL: ${result.page_url}\nContent: ${result.content.substring(0, 500)}${result.content.length > 500 ? '...' : ''}`
    ).join('\n\n')

    const sources = searchResults.map(result => ({
      title: result.page_title || 'Untitled',
      url: result.page_url || '',
      content: result.content.substring(0, 200) + (result.content.length > 200 ? '...' : ''),
      score: result.combined_score
    }))

    // Step 3: Build conversation context
    const systemPrompt = `You are a helpful AI assistant that answers questions based on the provided context from a knowledge base. 

IMPORTANT INSTRUCTIONS:
1. Answer ONLY based on the provided context below
2. If the context doesn't contain enough information to answer the question, say so clearly
3. Always cite your sources using [Source X] format
4. Be concise but comprehensive
5. If asked about something not in the context, politely explain that you can only answer based on the available knowledge base

CONTEXT:
${context}

Previous conversation:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Current question: ${message}

Please provide a helpful answer based on the context above, and make sure to cite your sources.`

    // Step 4: Generate AI response
    const client = getOpenAI()
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    })

    const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response at this time."

    console.log(`🤖 Generated AI response (${aiResponse.length} characters)`)

    // Step 5: Return response with sources
    const response = {
      message: aiResponse,
      sources,
      conversationHistory: [
        ...conversationHistory,
        {
          role: 'user' as const,
          content: message,
          timestamp: new Date().toISOString()
        },
        {
          role: 'assistant' as const,
          content: aiResponse,
          timestamp: new Date().toISOString(),
          sources
        }
      ]
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
