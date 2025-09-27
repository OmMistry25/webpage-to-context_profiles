#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

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
      .update({ status: 'running' })
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

    console.log(`🚀 Starting crawl for: ${crawl.root_url}`)

    // Update crawl status to running
    await supabase
      .from('crawls')
      .update({ 
        status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', crawl.id)

    // Perform the actual crawling
    await performCrawl(crawl as Crawl)

    // Mark job as completed
    await supabase
      .from('jobs')
      .update({ status: 'completed' })
      .eq('id', job.id)

    console.log(`✅ Job ${job.id} completed successfully`)

  } catch (error) {
    console.error('❌ Error in pollForJobs:', error)
  }
}

async function performCrawl(crawl: Crawl) {
  try {
    console.log(`🌐 Crawling: ${crawl.root_url}`)
    console.log(`📊 Scope: ${crawl.scope}, Max Depth: ${crawl.max_depth}, Max Pages: ${crawl.max_pages}`)

    // For now, let's implement a basic crawl that just fetches the root page
    const response = await fetch(crawl.root_url, {
      headers: {
        'User-Agent': 'Web-to-Context-Profile-Crawler/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const url = new URL(crawl.root_url)
    
    // Create a page record for the root page
    const { data: page, error: pageError } = await supabase
      .from('pages')
      .insert([
        {
          crawl_id: crawl.id,
          url: crawl.root_url,
          normalized_url: crawl.root_url,
          title: extractTitle(html),
          status_code: response.status,
          content_type: response.headers.get('content-type') || 'text/html',
          raw_html_path: `crawls/${crawl.id}/pages/${Date.now()}.html`,
          markdown_path: `crawls/${crawl.id}/pages/${Date.now()}.md`,
          links: extractLinks(html, crawl.root_url, crawl.scope),
          depth: 0,
          crawled_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (pageError) {
      console.error('❌ Error creating page record:', pageError)
      throw pageError
    }

    console.log(`📄 Created page record: ${page.id}`)

    // Update crawl statistics
    await supabase
      .from('crawls')
      .update({
        pages_crawled: 1,
        pages_failed: 0,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', crawl.id)

    console.log(`✅ Crawl completed: 1 page crawled`)

  } catch (error) {
    console.error('❌ Error during crawl:', error)
    
    // Update crawl status to failed
    await supabase
      .from('crawls')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
      .eq('id', crawl.id)

    throw error
  }
}

async function markJobFailed(jobId: string, errorMessage: string) {
  await supabase
    .from('jobs')
    .update({ 
      status: 'failed',
      error_message: errorMessage
    })
    .eq('id', jobId)
}

function extractTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return titleMatch ? titleMatch[1].trim() : null
}

function extractLinks(html: string, baseUrl: string, scope: string): string[] {
  const links: string[] = []
  const base = new URL(baseUrl)
  
  // Simple regex to find href attributes
  const linkRegex = /href\s*=\s*["']([^"']+)["']/gi
  let match
  
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const href = match[1]
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
      if (scope === 'domain' && url.hostname === base.hostname) {
        links.push(url.toString())
      } else if (scope === 'subdomain' && url.hostname.endsWith('.' + base.hostname)) {
        links.push(url.toString())
      } else if (scope === 'path' && url.origin === base.origin) {
        links.push(url.toString())
      }
    } catch (e) {
      // Skip invalid URLs
      continue
    }
  }
  
  return [...new Set(links)] // Remove duplicates
}

async function main() {
  console.log('🤖 Crawler Worker Started')
  console.log('========================')
  
  // Poll every 5 seconds
  setInterval(pollForJobs, 5000)
  
  // Also poll immediately
  await pollForJobs()
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Crawler Worker Stopped')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n👋 Crawler Worker Stopped')
  process.exit(0)
})

main().catch(console.error)
