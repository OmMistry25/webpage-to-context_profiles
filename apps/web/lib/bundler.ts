import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import archiver from 'archiver'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
config({ path: path.join(__dirname, '../../../apps/web/.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface BundleManifest {
  version: string
  created_at: string
  project_id: string
  project_name: string
  total_pages: number
  total_chunks: number
  total_crawls: number
  scope: string
  description?: string
}

export interface PageData {
  id: string
  url: string
  title: string
  status_code: number
  content_type: string
  depth: number
  crawled_at: string
  crawl_id: string
  project_id: string
  project_name: string
  links: string[]
  raw_html_path?: string
  markdown_path?: string
}

export interface ChunkData {
  id: string
  page_id: string
  content: string
  token_count: number
  chunk_index: number
  page_url: string
  page_title: string
  crawl_id: string
  project_id: string
  created_at: string
}

export interface GraphNode {
  id: string
  url: string
  title: string
  depth: number
  crawl_id: string
  project_id: string
}

export interface GraphEdge {
  source: string
  target: string
  type: 'link' | 'crawl'
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export class BundlerService {
  /**
   * Create a bundle for a specific project
   */
  async createBundle(projectId: string): Promise<{ bundleId: string; downloadUrl: string }> {
    try {
      console.log(`📦 Creating bundle for project: ${projectId}`)

      // Step 1: Fetch project data
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (projectError || !project) {
        throw new Error(`Project not found: ${projectId}`)
      }

      // Step 2: Fetch all crawls for this project
      const { data: crawls, error: crawlsError } = await supabase
        .from('crawls')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (crawlsError) {
        throw new Error(`Failed to fetch crawls: ${crawlsError.message}`)
      }

      if (!crawls || crawls.length === 0) {
        throw new Error('No crawls found for this project')
      }

      // Step 3: Fetch all pages for this project
      const { data: pages, error: pagesError } = await supabase
        .from('pages')
        .select(`
          *,
          crawls!inner(project_id, project_name:projects(name))
        `)
        .eq('crawls.project_id', projectId)

      if (pagesError) {
        throw new Error(`Failed to fetch pages: ${pagesError.message}`)
      }

      // Step 4: Fetch all chunks for this project
      const { data: chunks, error: chunksError } = await supabase
        .from('chunks')
        .select(`
          *,
          pages!inner(
            url,
            title,
            crawl_id,
            crawls!inner(project_id)
          )
        `)
        .eq('pages.crawls.project_id', projectId)

      if (chunksError) {
        throw new Error(`Failed to fetch chunks: ${chunksError.message}`)
      }

      console.log(`📊 Bundle data: ${crawls.length} crawls, ${pages?.length || 0} pages, ${chunks?.length || 0} chunks`)

      // Step 5: Create manifest
      const manifest: BundleManifest = {
        version: '1.0.0',
        created_at: new Date().toISOString(),
        project_id: project.id,
        project_name: project.name,
        total_pages: pages?.length || 0,
        total_chunks: chunks?.length || 0,
        total_crawls: crawls.length,
        scope: 'full',
        description: project.description || undefined
      }

      // Step 6: Prepare pages data
      const pagesData: PageData[] = (pages || []).map(page => ({
        id: page.id,
        url: page.url,
        title: page.title || 'Untitled',
        status_code: page.status_code,
        content_type: page.content_type,
        depth: page.depth,
        crawled_at: page.crawled_at,
        crawl_id: page.crawl_id,
        project_id: projectId,
        project_name: project.name,
        links: page.links || [],
        raw_html_path: page.raw_html_path,
        markdown_path: page.markdown_path
      }))

      // Step 7: Prepare chunks data
      const chunksData: ChunkData[] = (chunks || []).map(chunk => ({
        id: chunk.id,
        page_id: chunk.page_id,
        content: chunk.content,
        token_count: chunk.token_count,
        chunk_index: chunk.chunk_index,
        page_url: chunk.pages?.url || '',
        page_title: chunk.pages?.title || 'Untitled',
        crawl_id: chunk.pages?.crawl_id || '',
        project_id: projectId,
        created_at: chunk.created_at
      }))

      // Step 8: Create graph data
      const graphData = this.createGraphData(pagesData, crawls)

      // Step 9: Create bundle ID and filename
      const bundleId = `bundle-${projectId}-${Date.now()}`
      const filename = `profile-v1-${bundleId}.zip`

      // Step 10: Create zip file
      const zipBuffer = await this.createZipFile(manifest, pagesData, chunksData, graphData)

      // Step 11: Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bundles')
        .upload(filename, zipBuffer, {
          contentType: 'application/zip',
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Failed to upload bundle: ${uploadError.message}`)
      }

      // Step 12: Get public URL
      const { data: urlData } = supabase.storage
        .from('bundles')
        .getPublicUrl(filename)

      console.log(`✅ Bundle created successfully: ${filename}`)

      return {
        bundleId,
        downloadUrl: urlData.publicUrl
      }

    } catch (error) {
      console.error('❌ Bundle creation failed:', error)
      throw error
    }
  }

  /**
   * Create graph data from pages and crawls
   */
  private createGraphData(pages: PageData[], crawls: any[]): GraphData {
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []

    // Add crawl nodes
    crawls.forEach(crawl => {
      nodes.push({
        id: `crawl-${crawl.id}`,
        url: crawl.root_url,
        title: `Crawl: ${new URL(crawl.root_url).hostname}`,
        depth: 0,
        crawl_id: crawl.id,
        project_id: crawl.project_id
      })
    })

    // Add page nodes
    pages.forEach(page => {
      nodes.push({
        id: `page-${page.id}`,
        url: page.url,
        title: page.title,
        depth: page.depth,
        crawl_id: page.crawl_id,
        project_id: page.project_id
      })

      // Add edge from crawl to root page
      const crawl = crawls.find(c => c.id === page.crawl_id)
      if (crawl && page.depth === 0) {
        edges.push({
          source: `crawl-${crawl.id}`,
          target: `page-${page.id}`,
          type: 'crawl'
        })
      }

      // Add edges between linked pages
      page.links.forEach(linkUrl => {
        const linkedPage = pages.find(p => p.url === linkUrl)
        if (linkedPage) {
          edges.push({
            source: `page-${page.id}`,
            target: `page-${linkedPage.id}`,
            type: 'link'
          })
        }
      })
    })

    return { nodes, edges }
  }

  /**
   * Create zip file with all bundle data
   */
  private async createZipFile(
    manifest: BundleManifest,
    pages: PageData[],
    chunks: ChunkData[],
    graph: GraphData
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const archive = archiver('zip', { zlib: { level: 9 } })

      archive.on('data', (chunk) => chunks.push(chunk))
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)

      // Add manifest.json
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })

      // Add pages.csv
      if (pages.length > 0) {
        const csvContent = this.createCSVContent(pages)
        archive.append(csvContent, { name: 'pages.csv' })
      }

      // Add chunks.jsonl
      if (chunks.length > 0) {
        const jsonlContent = chunks.map(chunk => JSON.stringify(chunk)).join('\n')
        archive.append(jsonlContent, { name: 'chunks.jsonl' })
      }

      // Add graph.json
      archive.append(JSON.stringify(graph, null, 2), { name: 'graph.json' })

      // Add prompt packs
      this.addPromptPacks(archive)

      archive.finalize()
    })
  }

  /**
   * Create CSV content manually
   */
  private createCSVContent(data: PageData[]): string {
    const headers = [
      'id', 'url', 'title', 'status_code', 'content_type', 'depth',
      'crawled_at', 'crawl_id', 'project_id', 'project_name', 'links',
      'raw_html_path', 'markdown_path'
    ]
    
    const headerRow = headers.join(',')
    const dataRows = data.map(row => 
      headers.map(h => {
        const value = row[h as keyof PageData]
        // Escape CSV values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        if (Array.isArray(value)) {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`
        }
        return value || ''
      }).join(',')
    )
    
    return [headerRow, ...dataRows].join('\n')
  }

  /**
   * Add prompt packs to the bundle
   */
  private addPromptPacks(archive: archiver.Archiver): void {
    const promptPacks = {
      'prompt-packs/README.md': `# Prompt Packs

This directory contains pre-built prompt templates for working with your crawled content.

## Available Packs

- \`summarization.md\` - Templates for content summarization
- \`analysis.md\` - Templates for content analysis
- \`extraction.md\` - Templates for information extraction
- \`qa.md\` - Templates for question-answering

## Usage

Use these templates with your AI tools to get better results when working with your crawled content.
`,

      'prompt-packs/summarization.md': `# Summarization Prompts

## Document Summary
\`\`\`
Please provide a comprehensive summary of the following content:

[CONTENT]

Focus on:
- Key topics and themes
- Main arguments or points
- Important facts and figures
- Actionable insights
\`\`\`

## Executive Summary
\`\`\`
Create an executive summary of this content suitable for busy decision-makers:

[CONTENT]

Include:
- One-sentence overview
- 3-5 key takeaways
- Potential implications
- Recommended actions
\`\`\`
`,

      'prompt-packs/analysis.md': `# Analysis Prompts

## Content Analysis
\`\`\`
Analyze the following content and provide insights on:

[CONTENT]

Please analyze:
- Content structure and organization
- Writing style and tone
- Target audience
- Key messages
- Strengths and weaknesses
- Opportunities for improvement
\`\`\`

## Trend Analysis
\`\`\`
Identify trends and patterns in this content:

[CONTENT]

Look for:
- Emerging themes
- Recurring topics
- Temporal patterns
- Correlations
- Anomalies
\`\`\`
`,

      'prompt-packs/extraction.md': `# Information Extraction Prompts

## Key Facts Extraction
\`\`\`
Extract key facts and information from this content:

[CONTENT]

Please extract:
- Important dates and numbers
- Names of people, places, organizations
- Key statistics and metrics
- Technical specifications
- Contact information
- URLs and references
\`\`\`

## Structured Data Extraction
\`\`\`
Extract structured data from this content in JSON format:

[CONTENT]

Return data as JSON with these fields:
- title
- author
- date
- key_points (array)
- tags (array)
- summary
- links (array)
\`\`\`
`,

      'prompt-packs/qa.md': `# Question-Answering Prompts

## Contextual Q&A
\`\`\`
Based on the following content, answer the question:

[CONTENT]

Question: [QUESTION]

Please provide:
- Direct answer if available in the content
- Relevant context
- Source references
- Confidence level
- Additional related information
\`\`\`

## Multi-Document Q&A
\`\`\`
Answer this question using information from multiple documents:

Documents:
[DOCUMENT_1]
[DOCUMENT_2]
[DOCUMENT_3]

Question: [QUESTION]

Please:
- Synthesize information from all relevant documents
- Provide a comprehensive answer
- Cite specific sources
- Note any contradictions or gaps
\`\`\`
`
    }

    Object.entries(promptPacks).forEach(([filename, content]) => {
      archive.append(content, { name: filename })
    })
  }

  /**
   * Create a bundle for a specific crawl
   */
  async createCrawlBundle(crawlId: string): Promise<{ bundleId: string; downloadUrl: string }> {
    try {
      console.log(`📦 Creating bundle for crawl: ${crawlId}`)

      // Step 1: Fetch crawl data with project info
      const { data: crawl, error: crawlError } = await supabase
        .from('crawls')
        .select(`
          *,
          projects!inner(id, name, description)
        `)
        .eq('id', crawlId)
        .single()

      if (crawlError || !crawl) {
        throw new Error(`Crawl not found: ${crawlId}`)
      }

      // Step 2: Fetch all pages for this crawl
      const { data: pages, error: pagesError } = await supabase
        .from('pages')
        .select('*')
        .eq('crawl_id', crawlId)

      if (pagesError) {
        throw new Error(`Failed to fetch pages: ${pagesError.message}`)
      }

      // Step 3: Fetch all chunks for this crawl
      const { data: chunks, error: chunksError } = await supabase
        .from('chunks')
        .select(`
          *,
          pages!inner(url, title, crawl_id)
        `)
        .eq('pages.crawl_id', crawlId)

      if (chunksError) {
        throw new Error(`Failed to fetch chunks: ${chunksError.message}`)
      }

      console.log(`📊 Crawl bundle data: ${pages?.length || 0} pages, ${chunks?.length || 0} chunks`)

      // Step 4: Create manifest for this crawl
      const manifest: BundleManifest = {
        version: '1.0.0',
        created_at: new Date().toISOString(),
        project_id: crawl.projects.id,
        project_name: crawl.projects.name,
        total_pages: pages?.length || 0,
        total_chunks: chunks?.length || 0,
        total_crawls: 1,
        scope: 'crawl',
        description: `Bundle for crawl of ${crawl.root_url} (${crawl.scope} scope, depth ${crawl.max_depth}, max ${crawl.max_pages} pages)`
      }

      // Step 5: Prepare pages data
      const pagesData: PageData[] = (pages || []).map(page => ({
        id: page.id,
        url: page.url,
        title: page.title || 'Untitled',
        status_code: page.status_code,
        content_type: page.content_type,
        depth: page.depth,
        crawled_at: page.crawled_at,
        crawl_id: page.crawl_id,
        project_id: crawl.projects.id,
        project_name: crawl.projects.name,
        links: page.links || [],
        raw_html_path: page.raw_html_path,
        markdown_path: page.markdown_path
      }))

      // Step 6: Prepare chunks data
      const chunksData: ChunkData[] = (chunks || []).map(chunk => ({
        id: chunk.id,
        page_id: chunk.page_id,
        content: chunk.content,
        token_count: chunk.token_count,
        chunk_index: chunk.chunk_index,
        page_url: chunk.pages?.url || '',
        page_title: chunk.pages?.title || 'Untitled',
        crawl_id: chunk.pages?.crawl_id || '',
        project_id: crawl.projects.id,
        created_at: chunk.created_at
      }))

      // Step 7: Create graph data for this crawl
      const graphData = this.createGraphData(pagesData, [crawl])

      // Step 8: Create bundle ID and filename
      const bundleId = `crawl-bundle-${crawlId}-${Date.now()}`
      const crawlDomain = new URL(crawl.root_url).hostname.replace(/[^a-z0-9]/gi, '_')
      const filename = `crawl-${crawlDomain}-${Date.now()}.zip`

      // Step 9: Create zip file
      const zipBuffer = await this.createZipFile(manifest, pagesData, chunksData, graphData)

      // Step 10: Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bundles')
        .upload(filename, zipBuffer, {
          contentType: 'application/zip',
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Failed to upload bundle: ${uploadError.message}`)
      }

      // Step 11: Get public URL
      const { data: urlData } = supabase.storage
        .from('bundles')
        .getPublicUrl(filename)

      console.log(`✅ Crawl bundle created successfully: ${filename}`)

      return {
        bundleId,
        downloadUrl: urlData.publicUrl
      }

    } catch (error) {
      console.error('❌ Crawl bundle creation failed:', error)
      throw error
    }
  }

  /**
   * Create a comprehensive bundle for all user data
   */
  async createUserDataBundle(
    userId: string, 
    options: {
      includeEmbeddings?: boolean
      includeMetadata?: boolean
      format?: 'zip' | 'json' | 'csv'
    } = {}
  ): Promise<{ bundleId: string; downloadUrl: string }> {
    try {
      console.log(`📦 Creating user data bundle for user: ${userId}`)

      // Step 1: Fetch all user's projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('owner', userId)
        .order('created_at', { ascending: false })

      if (projectsError) {
        throw new Error(`Failed to fetch projects: ${projectsError.message}`)
      }

      if (!projects || projects.length === 0) {
        throw new Error('No projects found for this user')
      }

      // Step 2: Fetch all user's crawls
      const { data: crawls, error: crawlsError } = await supabase
        .from('crawls')
        .select(`
          *,
          projects!inner(id, name, owner)
        `)
        .eq('projects.owner', userId)
        .order('created_at', { ascending: false })

      if (crawlsError) {
        throw new Error(`Failed to fetch crawls: ${crawlsError.message}`)
      }

      // Step 3: Fetch all user's pages
      const { data: pages, error: pagesError } = await supabase
        .from('pages')
        .select(`
          *,
          crawls!inner(project_id, projects!inner(owner))
        `)
        .eq('crawls.projects.owner', userId)

      if (pagesError) {
        throw new Error(`Failed to fetch pages: ${pagesError.message}`)
      }

      // Step 4: Fetch all user's chunks
      const { data: chunks, error: chunksError } = await supabase
        .from('chunks')
        .select(`
          *,
          pages!inner(
            url,
            title,
            crawl_id,
            crawls!inner(project_id, projects!inner(owner))
          )
        `)
        .eq('pages.crawls.projects.owner', userId)

      if (chunksError) {
        throw new Error(`Failed to fetch chunks: ${chunksError.message}`)
      }

      console.log(`📊 User data bundle: ${projects.length} projects, ${crawls?.length || 0} crawls, ${pages?.length || 0} pages, ${chunks?.length || 0} chunks`)

      // Step 5: Create comprehensive manifest
      const manifest: BundleManifest = {
        version: '1.0.0',
        created_at: new Date().toISOString(),
        project_id: 'user-data',
        project_name: 'Complete User Data Export',
        total_pages: pages?.length || 0,
        total_chunks: chunks?.length || 0,
        total_crawls: crawls?.length || 0,
        scope: 'user-data',
        description: `Complete data export for user ${userId} including all projects, crawls, pages, and content chunks`
      }

      // Step 6: Prepare comprehensive data
      const pagesData: PageData[] = (pages || []).map(page => ({
        id: page.id,
        url: page.url,
        title: page.title || 'Untitled',
        status_code: page.status_code,
        content_type: page.content_type,
        depth: page.depth,
        crawled_at: page.crawled_at,
        crawl_id: page.crawl_id,
        project_id: page.crawls?.project_id || '',
        project_name: projects.find(p => p.id === page.crawls?.project_id)?.name || 'Unknown',
        links: page.links || [],
        raw_html_path: page.raw_html_path,
        markdown_path: page.markdown_path
      }))

      const chunksData: ChunkData[] = (chunks || []).map(chunk => ({
        id: chunk.id,
        page_id: chunk.page_id,
        content: chunk.content,
        token_count: chunk.token_count,
        chunk_index: chunk.chunk_index,
        page_url: chunk.pages?.url || '',
        page_title: chunk.pages?.title || 'Untitled',
        crawl_id: chunk.pages?.crawl_id || '',
        project_id: chunk.pages?.crawls?.project_id || '',
        created_at: chunk.created_at
      }))

      // Step 7: Create comprehensive graph data
      const graphData = this.createGraphData(pagesData, crawls || [])

      // Step 8: Create bundle ID and filename
      const bundleId = `user-data-${userId}-${Date.now()}`
      const filename = `user-data-export-${Date.now()}.zip`

      // Step 9: Create zip file
      const zipBuffer = await this.createUserDataZipFile(
        manifest, 
        projects, 
        crawls || [], 
        pagesData, 
        chunksData, 
        graphData,
        options
      )

      // Step 10: Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bundles')
        .upload(filename, zipBuffer, {
          contentType: 'application/zip',
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Failed to upload bundle: ${uploadError.message}`)
      }

      // Step 11: Get public URL
      const { data: urlData } = supabase.storage
        .from('bundles')
        .getPublicUrl(filename)

      console.log(`✅ User data bundle created successfully: ${filename}`)

      return {
        bundleId,
        downloadUrl: urlData.publicUrl
      }

    } catch (error) {
      console.error('❌ User data bundle creation failed:', error)
      throw error
    }
  }

  /**
   * Create comprehensive zip file for user data
   */
  private async createUserDataZipFile(
    manifest: BundleManifest,
    projects: any[],
    crawls: any[],
    pages: PageData[],
    chunks: ChunkData[],
    graph: GraphData,
    options: {
      includeEmbeddings?: boolean
      includeMetadata?: boolean
      format?: 'zip' | 'json' | 'csv'
    }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const archive = archiver('zip', { zlib: { level: 9 } })

      archive.on('data', (chunk) => chunks.push(chunk))
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)

      // Add manifest.json
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })

      // Add projects.json
      archive.append(JSON.stringify(projects, null, 2), { name: 'projects.json' })

      // Add crawls.json
      archive.append(JSON.stringify(crawls, null, 2), { name: 'crawls.json' })

      // Add pages data
      if (pages.length > 0) {
        if (options.format === 'csv') {
          const csvContent = this.createCSVContent(pages)
          archive.append(csvContent, { name: 'pages.csv' })
        } else {
          archive.append(JSON.stringify(pages, null, 2), { name: 'pages.json' })
        }
      }

      // Add chunks data
      if (chunks.length > 0) {
        if (options.format === 'csv') {
          const csvContent = this.createChunksCSVContent(chunks)
          archive.append(csvContent, { name: 'chunks.csv' })
        } else {
          const jsonlContent = chunks.map(chunk => JSON.stringify(chunk)).join('\n')
          archive.append(jsonlContent, { name: 'chunks.jsonl' })
        }
      }

      // Add graph.json
      archive.append(JSON.stringify(graph, null, 2), { name: 'graph.json' })

      // Add summary statistics
      const summary = {
        total_projects: projects.length,
        total_crawls: crawls.length,
        total_pages: pages.length,
        total_chunks: chunks.length,
        total_tokens: chunks.reduce((sum, chunk) => sum + chunk.token_count, 0),
        export_date: new Date().toISOString(),
        user_id: manifest.project_id === 'user-data' ? 'user-data' : 'unknown'
      }
      archive.append(JSON.stringify(summary, null, 2), { name: 'summary.json' })

      // Add prompt packs
      this.addPromptPacks(archive)

      archive.finalize()
    })
  }

  /**
   * Create CSV content for chunks
   */
  private createChunksCSVContent(data: ChunkData[]): string {
    const headers = [
      'id', 'page_id', 'content', 'token_count', 'chunk_index', 
      'page_url', 'page_title', 'crawl_id', 'project_id', 'created_at'
    ]
    
    const headerRow = headers.join(',')
    const dataRows = data.map(row => 
      headers.map(h => {
        const value = row[h as keyof ChunkData]
        // Escape CSV values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value || ''
      }).join(',')
    )
    
    return [headerRow, ...dataRows].join('\n')
  }

  /**
   * Get latest bundle for a project
   */
  async getLatestBundle(projectId: string): Promise<{ bundleId: string; downloadUrl: string } | null> {
    try {
      const { data: files, error } = await supabase.storage
        .from('bundles')
        .list('', {
          search: `profile-v1-bundle-${projectId}-`
        })

      if (error) {
        throw new Error(`Failed to list bundles: ${error.message}`)
      }

      if (!files || files.length === 0) {
        return null
      }

      // Sort by creation time and get the latest
      const latestFile = files.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]

      const { data: urlData } = supabase.storage
        .from('bundles')
        .getPublicUrl(latestFile.name)

      return {
        bundleId: latestFile.name,
        downloadUrl: urlData.publicUrl
      }

    } catch (error) {
      console.error('❌ Failed to get latest bundle:', error)
      throw error
    }
  }
}
