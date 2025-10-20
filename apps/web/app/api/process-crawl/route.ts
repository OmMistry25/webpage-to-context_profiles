import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { config } from 'dotenv'
import path from 'path'

// Load environment variables
config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface CrawlJob {
  id: string
  type: string
  payload: { crawl_id: string }
  created_at: string
}

interface Crawl {
  id: string
  project_id: string
  root_url: string
  scope: string
  max_depth: number
  max_pages: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  pages_crawled: number
  pages_failed: number
}

interface CrawlQueueItem {
  url: string
  depth: number
  parentUrl?: string
}

interface CrawledPage {
  url: string
  title: string
  content: string
  links: string[]
  depth: number
}

class MultiDepthCrawler {
  private crawl: Crawl
  private crawlQueue: CrawlQueueItem[] = []
  private crawledUrls = new Set<string>()
  private pagesCrawled = 0
  private pagesFailed = 0

  constructor(crawl: Crawl) {
    this.crawl = crawl
  }

  async crawlWebsite(): Promise<void> {
    console.log(`🌐 Starting multi-depth crawl: ${this.crawl.root_url}`)
    console.log(`📊 Scope: ${this.crawl.scope}, Max Depth: ${this.crawl.max_depth}, Max Pages: ${this.crawl.max_pages}`)

    // Initialize queue with root URL
    this.crawlQueue.push({
      url: this.crawl.root_url,
      depth: 0
    })

    // Process queue until empty or limits reached
    while (this.crawlQueue.length > 0 && this.pagesCrawled < this.crawl.max_pages) {
      const item = this.crawlQueue.shift()!
      
      // Skip if already crawled or depth exceeded
      if (this.crawledUrls.has(item.url) || item.depth > this.crawl.max_depth) {
        continue
      }

      try {
        const page = await this.crawlPage(item)
        if (page) {
          await this.savePage(page)
          this.crawledUrls.add(item.url)
          this.pagesCrawled++

          // Add new links to queue if within depth limit
          if (item.depth < this.crawl.max_depth) {
            this.addLinksToQueue(page.links, item.depth + 1, item.url)
          }

          console.log(`✅ Crawled: ${page.url} (depth ${page.depth}) - ${page.links.length} links found`)
        }
      } catch (error) {
        console.error(`❌ Failed to crawl ${item.url}:`, error)
        this.pagesFailed++
      }

      // Update progress every 5 pages (reduced for serverless)
      if (this.pagesCrawled % 5 === 0) {
        await this.updateCrawlProgress()
      }
    }

    // Final update
    await this.updateCrawlProgress()
    console.log(`🎉 Crawl completed: ${this.pagesCrawled} pages crawled, ${this.pagesFailed} failed`)
  }

  private async crawlPage(item: CrawlQueueItem): Promise<CrawledPage | null> {
    try {
      // For serverless, we'll use a simplified crawling approach
      // In production, you might want to use a service like Puppeteer
      const response = await fetch(item.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WebToContextBot/1.0)'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const html = await response.text()
      const title = this.extractTitle(html)
      const content = this.extractContent(html)
      const links = this.extractLinks(html, item.url)

      return {
        url: item.url,
        title,
        content,
        links,
        depth: item.depth
      }
    } catch (error) {
      console.error(`Failed to crawl ${item.url}:`, error)
      return null
    }
  }

  private extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    return titleMatch ? titleMatch[1].trim() : 'Untitled'
  }

  private extractContent(html: string): string {
    // Simple content extraction - remove scripts, styles, etc.
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    return content.substring(0, 10000) // Limit content size
  }

  private extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = []
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
    let match

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1]
      const absoluteUrl = this.resolveUrl(href, baseUrl)
      
      if (this.shouldCrawlUrl(absoluteUrl)) {
        links.push(absoluteUrl)
      }
    }

    return [...new Set(links)] // Remove duplicates
  }

  private resolveUrl(href: string, baseUrl: string): string {
    try {
      return new URL(href, baseUrl).href
    } catch {
      return href
    }
  }

  private shouldCrawlUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      
      // Only crawl same domain for path scope
      if (this.crawl.scope === 'path') {
        const baseUrl = new URL(this.crawl.root_url)
        return urlObj.hostname === baseUrl.hostname
      }
      
      // For other scopes, implement additional logic
      return true
    } catch {
      return false
    }
  }

  private addLinksToQueue(links: string[], depth: number, parentUrl: string): void {
    for (const link of links) {
      if (!this.crawledUrls.has(link) && this.crawlQueue.length < 100) { // Limit queue size
        this.crawlQueue.push({
          url: link,
          depth,
          parentUrl
        })
      }
    }
  }

  private async savePage(page: CrawledPage): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('pages')
        .insert([
          {
            crawl_id: this.crawl.id,
            url: page.url,
            normalized_url: page.url,
            title: page.title,
            description: page.content.substring(0, 200),
            status_code: 200,
            content_type: 'text/html',
            status: 'completed',
            depth: page.depth,
            links: page.links
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('❌ Error saving page:', error)
        throw error
      }

      // Create a chunk for the page content
      await supabase
        .from('chunks')
        .insert([
          {
            page_id: data.id,
            chunk_index: 0,
            content: page.content,
            token_count: Math.ceil(page.content.length / 4) // Rough token estimate
          }
        ])

    } catch (error) {
      console.error('❌ Error saving page:', error)
      throw error
    }
  }

  private async updateCrawlProgress(): Promise<void> {
    await supabase
      .from('crawls')
      .update({
        pages_crawled: this.pagesCrawled,
        pages_failed: this.pagesFailed,
        status: this.pagesCrawled >= this.crawl.max_pages ? 'completed' : 'running'
      })
      .eq('id', this.crawl.id)
  }
}

async function pollForJobs() {
  console.log('🔍 Polling for crawl jobs...')
  
  try {
    // Get pending crawl jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'pending')
      .eq('type', 'crawl')
      .order('created_at', { ascending: true })
      .limit(1)

    if (jobsError) {
      console.error('❌ Error fetching jobs:', jobsError)
      return { success: false, error: jobsError.message }
    }

    if (!jobs || jobs.length === 0) {
      console.log('⏳ No pending jobs found')
      return { success: true, message: 'No pending jobs' }
    }

    const job = jobs[0] as CrawlJob
    const crawlId = job.payload.crawl_id
    console.log(`🎯 Found job: ${job.id} for crawl: ${crawlId}`)

    // Mark job as running
    await supabase
      .from('jobs')
      .update({ 
        status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', job.id)

    // Get crawl details
    const { data: crawl, error: crawlError } = await supabase
      .from('crawls')
      .select('*')
      .eq('id', crawlId)
      .single()

    if (crawlError || !crawl) {
      console.error('❌ Error fetching crawl:', crawlError)
      await markJobFailed(job.id, 'Crawl not found')
      return { success: false, error: 'Crawl not found' }
    }

    // Update crawl status to running
    await supabase
      .from('crawls')
      .update({ 
        status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', crawl.id)

    // Perform multi-depth crawling
    const crawler = new MultiDepthCrawler(crawl as Crawl)
    await crawler.crawlWebsite()

    // Mark crawl as completed
    await supabase
      .from('crawls')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', crawl.id)

    // Mark job as completed
    await supabase
      .from('jobs')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id)

    console.log(`✅ Job ${job.id} completed successfully`)
    return { success: true, message: `Crawl ${crawlId} completed` }

  } catch (error) {
    console.error('❌ Job processing failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function markJobFailed(jobId: string, errorMessage: string) {
  await supabase
    .from('jobs')
    .update({ 
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString()
    })
    .eq('id', jobId)
}

export async function GET(request: NextRequest) {
  try {
    console.log('🤖 Serverless Crawler Worker Started')
    console.log('=====================================')
    
    const result = await pollForJobs()
    
    return NextResponse.json({
      success: result.success,
      message: result.message || result.error,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Serverless crawler failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Allow manual triggering via POST
  return GET(request)
}
