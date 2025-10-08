import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { WebToContextAPI } from '../api-client'

export const searchCommand = new Command('search')
  .description('Search through user data')

searchCommand
  .argument('<query>', 'Search query')
  .option('-s, --scope <scope>', 'Search scope', 'all')
  .option('-l, --limit <number>', 'Result limit', '10')
  .option('-o, --offset <number>', 'Result offset', '0')
  .option('-f, --format <format>', 'Output format', 'table')
  .option('-p, --project-ids <ids>', 'Filter by project IDs (comma-separated)')
  .option('-d, --date-range <range>', 'Filter by date range (YYYY-MM-DD:YYYY-MM-DD)')
  .action(async (query, options) => {
    const spinner = ora('Searching...').start()
    
    try {
      const api = new WebToContextAPI({
        apiUrl: process.env.WEB_TO_CONTEXT_API_URL || 'http://localhost:3000'
      })

      await api.loadConfig()

      if (!api.isAuthenticated()) {
        spinner.fail('Not authenticated')
        console.error(chalk.red('❌ Please run: web-to-context auth login'))
        return
      }

      const config = api.getConfig()

      // Parse filters
      const filters: any = {}
      
      if (options.projectIds) {
        filters.projectIds = options.projectIds.split(',').map((id: string) => id.trim())
      }
      
      if (options.dateRange) {
        const [start, end] = options.dateRange.split(':')
        if (start && end) {
          filters.dateRange = { start, end }
        }
      }

      // Validate scope
      const validScopes = ['projects', 'crawls', 'chunks', 'all']
      if (!validScopes.includes(options.scope)) {
        spinner.fail('Invalid scope')
        console.error(chalk.red(`❌ Invalid scope. Must be one of: ${validScopes.join(', ')}`))
        return
      }

      const results = await api.search({
        query,
        userId: config.userId!,
        scope: options.scope as any,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        limit: parseInt(options.limit),
        offset: parseInt(options.offset)
      })

      spinner.succeed(`Found ${results.totalResults} results`)

      if (results.results.length === 0) {
        console.log(chalk.yellow('No results found'))
        return
      }

      // Display results based on format
      if (options.format === 'json') {
        console.log(JSON.stringify(results, null, 2))
      } else {
        displaySearchResults(results.results, options.format)
      }

    } catch (error) {
      spinner.fail('Search failed')
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
    }
  })

function displaySearchResults(results: any[], format: string) {
  if (format === 'table') {
    // Group results by type
    const projects = results.filter(r => r.type === 'project')
    const crawls = results.filter(r => r.type === 'crawl')
    const chunks = results.filter(r => r.type === 'chunk')

    if (projects.length > 0) {
      console.log(chalk.cyan('\n📁 Projects:'))
      projects.forEach(project => {
        console.log(`  ${chalk.green(project.name)}`)
        console.log(`    ID: ${project.id}`)
        console.log(`    Description: ${project.description || 'No description'}`)
        console.log(`    Created: ${new Date(project.createdAt).toLocaleDateString()}`)
        console.log('')
      })
    }

    if (crawls.length > 0) {
      console.log(chalk.cyan('\n🕷️  Crawls:'))
      crawls.forEach(crawl => {
        console.log(`  ${chalk.blue(crawl.url)}`)
        console.log(`    ID: ${crawl.id}`)
        console.log(`    Project: ${crawl.projectName}`)
        console.log(`    Status: ${getStatusColor(crawl.status)}`)
        console.log(`    Scope: ${crawl.scope}, Depth: ${crawl.maxDepth}, Pages: ${crawl.maxPages}`)
        console.log(`    Created: ${new Date(crawl.createdAt).toLocaleDateString()}`)
        console.log('')
      })
    }

    if (chunks.length > 0) {
      console.log(chalk.cyan('\n📄 Content Chunks:'))
      chunks.forEach(chunk => {
        console.log(`  ${chalk.yellow(chunk.pageTitle || chunk.pageUrl)}`)
        console.log(`    ID: ${chunk.id}`)
        console.log(`    URL: ${chunk.pageUrl}`)
        console.log(`    Content: ${chunk.content.substring(0, 100)}...`)
        console.log(`    Created: ${new Date(chunk.createdAt).toLocaleDateString()}`)
        console.log('')
      })
    }
  } else {
    // Simple list format
    results.forEach((result, index) => {
      const typeIcon = {
        project: '📁',
        crawl: '🕷️',
        chunk: '📄'
      }[result.type] || '📄'
      
      console.log(`${index + 1}. ${typeIcon} ${result.name || result.url || result.pageTitle || result.id}`)
    })
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return chalk.green(status)
    case 'running':
      return chalk.yellow(status)
    case 'failed':
      return chalk.red(status)
    case 'pending':
      return chalk.blue(status)
    default:
      return status
  }
}
