#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { JSDOM } from 'jsdom'
import TurndownService from 'turndown'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
config({ path: path.join(__dirname, '../../../apps/web/.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Initialize Turndown service for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced'
})

interface CrawlJob {
  id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
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
  title: string | null
  content: string
  links: string[]
  statusCode: number
  contentType: string
  depth: number
  htmlPath: string | null
  markdownPath: string | null
}

class MultiDepthCrawler {
  private crawl: Crawl
  private crawledUrls: Set<string> = new Set()
  private crawlQueue: CrawlQueueItem[] = []
  private pagesCrawled: number = 0
  private pagesFailed: number = 0

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

      // Update progress every 10 pages
      if (this.pagesCrawled % 10 === 0) {
        await this.updateCrawlProgress()
      }
    }

    // Final update
    await this.updateCrawlProgress()
    console.log(`🎉 Crawl completed: ${this.pagesCrawled} pages crawled, ${this.pagesFailed} failed`)
  }

  private async crawlPage(item: CrawlQueueItem): Promise<CrawledPage | null> {
    try {
      const response = await fetch(item.url, {
        headers: {
          'User-Agent': 'Web-to-Context-Profile-Crawler/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        timeout: 10000 // 10 second timeout
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const html = await response.text()
      const contentType = response.headers.get('content-type') || 'text/html'

      // Only process HTML content
      if (!contentType.includes('text/html')) {
        console.log(`⏭️  Skipping non-HTML content: ${item.url} (${contentType})`)
        return null
      }

      const dom = new JSDOM(html)
      const document = dom.window.document

      // Extract title
      const title = document.querySelector('title')?.textContent?.trim() || null

      // Extract content (convert HTML to Markdown)
      const content = this.extractContent(document)

      // Extract and filter links
      const links = this.extractAndFilterLinks(document, item.url)

      // Upload content to Supabase Storage
      const htmlFileName = `crawls/${this.crawl.id}/pages/${Date.now()}.html`
      const markdownFileName = `crawls/${this.crawl.id}/pages/${Date.now()}.md`

      let htmlPath: string | null = null
      let markdownPath: string | null = null

      try {
        // Upload raw HTML
        const { error: htmlUploadError } = await supabase.storage
          .from('crawl_data')
          .upload(htmlFileName, html, { contentType: 'text/html' })

        if (htmlUploadError) {
          console.error('❌ Error uploading HTML to storage:', htmlUploadError)
        } else {
          htmlPath = htmlFileName
          console.log(`✅ Uploaded HTML: ${htmlFileName}`)
        }

        // Upload Markdown content
        if (content) {
          const { error: markdownUploadError } = await supabase.storage
            .from('crawl_data')
            .upload(markdownFileName, content, { contentType: 'text/markdown' })

          if (markdownUploadError) {
            console.error('❌ Error uploading Markdown to storage:', markdownUploadError)
          } else {
            markdownPath = markdownFileName
            console.log(`✅ Uploaded Markdown: ${markdownFileName}`)
          }
        }
      } catch (storageError) {
        console.error('❌ Storage upload error:', storageError)
      }

      return {
        url: item.url,
        title,
        content,
        links,
        statusCode: response.status,
        contentType,
        depth: item.depth,
        htmlPath,
        markdownPath
      }

    } catch (error) {
      console.error(`❌ Error crawling ${item.url}:`, error)
      throw error
    }
  }

  private extractContent(document: Document): string {
    // Remove script and style elements
    const scripts = document.querySelectorAll('script, style, nav, header, footer, aside')
    scripts.forEach(el => el.remove())

    // Get main content area or body
    const mainContent = document.querySelector('main, article, .content, .main, #content, #main') || document.body
    
    if (!mainContent) {
      return ''
    }

    // Convert to Markdown
    const markdown = turndownService.turndown(mainContent.innerHTML)
    
    // Clean up the markdown
    return markdown
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .replace(/^\s+|\s+$/g, '') // Trim whitespace
      .substring(0, 50000) // Limit content length
  }

  private extractAndFilterLinks(document: Document, baseUrl: string): string[] {
    const links: string[] = []
    const base = new URL(baseUrl)
    
    const linkElements = document.querySelectorAll('a[href]')
    
    for (const link of linkElements) {
      const href = link.getAttribute('href')
      if (!href) continue

      try {
        let url: URL
        
        if (href.startsWith('http://') || href.startsWith('https://')) {
          url = new URL(href)
        } else if (href.startsWith('//')) {
          url = new URL(base.protocol + href)
        } else if (href.startsWith('/')) {
          url = new URL(href, base.origin)
        } else {
          url = new URL(href, baseUrl)
        }

        // Apply scope filtering
        if (this.isUrlInScope(url, base)) {
          // Normalize URL (remove fragments, trailing slashes, etc.)
          const normalizedUrl = this.normalizeUrl(url.toString())
          if (normalizedUrl && !this.crawledUrls.has(normalizedUrl)) {
            links.push(normalizedUrl)
          }
        }
      } catch (e) {
        // Skip invalid URLs
        continue
      }
    }
    
    return [...new Set(links)] // Remove duplicates
  }

  private isUrlInScope(url: URL, base: URL): boolean {
    switch (this.crawl.scope) {
      case 'domain':
        return url.hostname === base.hostname
      case 'subdomain':
        return url.hostname === base.hostname || url.hostname.endsWith('.' + base.hostname)
      case 'path':
        return url.origin === base.origin && url.pathname.startsWith(base.pathname)
      default:
        return true
    }
  }

  private normalizeUrl(url: string): string | null {
    try {
      const urlObj = new URL(url)
      
      // Remove fragment
      urlObj.hash = ''
      
      // Remove trailing slash for non-root paths
      if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
        urlObj.pathname = urlObj.pathname.slice(0, -1)
      }
      
      // Remove common tracking parameters
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']
      trackingParams.forEach(param => urlObj.searchParams.delete(param))
      
      return urlObj.toString()
    } catch (e) {
      return null
    }
  }

  private addLinksToQueue(links: string[], depth: number, parentUrl: string): void {
    for (const link of links) {
      if (!this.crawledUrls.has(link) && this.crawlQueue.length < 1000) { // Prevent queue overflow
        this.crawlQueue.push({
          url: link,
          depth,
          parentUrl
        })
      }
    }
  }

  private async savePage(page: CrawledPage): Promise<void> {
    const { data: savedPage, error } = await supabase
      .from('pages')
      .insert([
        {
          crawl_id: this.crawl.id,
          url: page.url,
          normalized_url: page.url,
          title: page.title,
          status_code: page.statusCode,
          content_type: page.contentType,
          raw_html_path: page.htmlPath,
          markdown_path: page.markdownPath,
          links: page.links,
          depth: page.depth,
          crawled_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (error) {
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
      return
    }

    if (!jobs || jobs.length === 0) {
      console.log('⏳ No pending jobs found')
      return
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
      return
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

  } catch (error) {
    console.error('❌ Error in pollForJobs:', error)
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

async function main() {
  console.log('🤖 Enhanced Multi-Depth Crawler Worker Started')
  console.log('=============================================')
  console.log('✨ Features:')
  console.log('  - Multi-depth crawling (follows links)')
  console.log('  - Content extraction (HTML to Markdown)')
  console.log('  - URL filtering by scope')
  console.log('  - Respects max_pages and max_depth limits')
  console.log('  - URL deduplication and normalization')
  console.log('=============================================')
  
  // Poll every 5 seconds
  setInterval(pollForJobs, 5000)
  
  // Also poll immediately
  await pollForJobs()
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Enhanced Crawler Worker Stopped')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n👋 Enhanced Crawler Worker Stopped')
  process.exit(0)
})

main().catch(console.error)