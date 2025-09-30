#!/usr/bin/env node

import TokenAwareSplitter from './index.js'

async function testSplitter() {
  console.log('🧪 Testing Token-Aware Text Splitter')
  console.log('=====================================')

  const splitter = new TokenAwareSplitter({
    maxTokens: 500,
    overlapTokens: 50,
    minTokens: 25
  })

  // Test with sample text
  const sampleText = `
# Introduction to Web Crawling

Web crawling is the process of systematically browsing the World Wide Web for the purpose of extracting information. This process is typically performed by automated software called web crawlers or spiders.

## How Web Crawlers Work

Web crawlers start with a list of URLs to visit, called the seed list. As the crawler visits these URLs, it identifies all the hyperlinks in the page and adds them to the list of URLs to visit. This process continues recursively until all pages have been visited or until some other stopping criterion is met.

### Key Components

1. **URL Frontier**: A data structure that manages the URLs to be crawled
2. **Parser**: Extracts links and content from HTML pages
3. **Storage**: Stores the crawled content for later processing
4. **Deduplication**: Ensures the same URL is not crawled multiple times

## Best Practices

When building a web crawler, it's important to follow these best practices:

- Respect robots.txt files
- Implement rate limiting to avoid overwhelming servers
- Handle different content types appropriately
- Implement proper error handling and retry logic
- Use appropriate user agents and headers

## Challenges

Web crawling presents several challenges:

1. **Dynamic Content**: Many modern websites use JavaScript to load content dynamically
2. **Rate Limiting**: Servers may block or throttle requests from crawlers
3. **Content Variety**: Different websites use different structures and formats
4. **Scale**: Large-scale crawling requires distributed systems and careful resource management

## Conclusion

Web crawling is a complex but essential technology for many applications, including search engines, data mining, and content aggregation. By following best practices and understanding the challenges involved, developers can build effective and responsible web crawlers.
  `.trim()

  console.log('📝 Sample text length:', sampleText.length, 'characters')
  console.log('📊 Estimated tokens:', Math.ceil(sampleText.length / 4))
  console.log()

  // Split the text
  const chunks = splitter.splitText(sampleText)

  console.log(`🔪 Split into ${chunks.length} chunks:`)
  console.log()

  chunks.forEach((chunk, index) => {
    console.log(`--- Chunk ${index + 1} ---`)
    console.log(`Tokens: ${chunk.token_count}`)
    console.log(`Characters: ${chunk.content.length}`)
    console.log(`Position: ${chunk.start_char}-${chunk.end_char}`)
    console.log(`Content preview: ${chunk.content.substring(0, 100)}...`)
    console.log()
  })

  // Test with a real page if available
  console.log('🔍 Testing with real page data...')
  
  try {
    // Get a recent page from the database
    const { createClient } = await import('@supabase/supabase-js')
    const { config } = await import('dotenv')
    const path = await import('path')
    const { fileURLToPath } = await import('url')

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)

    config({ path: path.join(__dirname, '../../../apps/web/.env.local') })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: pages, error } = await supabase
      .from('pages')
      .select('id, title, url, markdown_path')
      .not('markdown_path', 'is', null)
      .limit(1)

    if (error) {
      console.error('❌ Error fetching pages:', error)
      return
    }

    if (pages && pages.length > 0) {
      const page = pages[0]
      console.log(`📄 Testing with page: ${page.title}`)
      console.log(`🔗 URL: ${page.url}`)
      
      const realChunks = await splitter.processPage(page.id)
      console.log(`✅ Created ${realChunks.length} chunks from real page`)
      
      if (realChunks.length > 0) {
        console.log('📊 Chunk statistics:')
        console.log(`   Total tokens: ${realChunks.reduce((sum, chunk) => sum + chunk.token_count, 0)}`)
        console.log(`   Average tokens per chunk: ${Math.round(realChunks.reduce((sum, chunk) => sum + chunk.token_count, 0) / realChunks.length)}`)
        console.log(`   Min tokens: ${Math.min(...realChunks.map(c => c.token_count))}`)
        console.log(`   Max tokens: ${Math.max(...realChunks.map(c => c.token_count))}`)
      }
    } else {
      console.log('⏭️  No pages with markdown content found')
    }

  } catch (error) {
    console.error('❌ Error testing with real data:', error)
  }

  console.log()
  console.log('✅ Test completed!')
}

testSplitter().catch(console.error)
