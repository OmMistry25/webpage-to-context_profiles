import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import axios from 'axios'
import fs from 'fs-extra'
import path from 'path'
import { WebToContextAPI } from '../api-client'

export const exportCommand = new Command('export')
  .description('Export user data')

exportCommand
  .argument('<type>', 'Export type (project|crawl|user-data)')
  .argument('<id>', 'Resource ID to export')
  .option('-f, --format <format>', 'Export format', 'zip')
  .option('--include-embeddings', 'Include vector embeddings')
  .option('--include-metadata', 'Include metadata')
  .option('-o, --output <path>', 'Output file path')
  .action(async (type, id, options) => {
    const spinner = ora('Preparing export...').start()
    
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

      // Validate export type
      const validTypes = ['project', 'crawl', 'user-data']
      if (!validTypes.includes(type)) {
        spinner.fail('Invalid export type')
        console.error(chalk.red(`❌ Invalid type. Must be one of: ${validTypes.join(', ')}`))
        return
      }

      // Validate format
      const validFormats = ['zip', 'json', 'csv']
      if (!validFormats.includes(options.format)) {
        spinner.fail('Invalid export format')
        console.error(chalk.red(`❌ Invalid format. Must be one of: ${validFormats.join(', ')}`))
        return
      }

      spinner.text = 'Requesting export...'

      const exportResult = await api.export({
        resourceType: type as any,
        resourceId: id,
        userId: config.userId!,
        format: options.format as any,
        includeEmbeddings: options.includeEmbeddings,
        includeMetadata: options.includeMetadata
      })

      spinner.text = 'Downloading export...'

      // Download the file
      const response = await axios({
        method: 'GET',
        url: exportResult.downloadUrl,
        responseType: 'stream'
      })

      // Generate output filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const defaultFilename = `${type}-${id}-${timestamp}.${options.format}`
      const outputPath = options.output || path.join(process.cwd(), defaultFilename)

      // Ensure output directory exists
      await fs.ensureDir(path.dirname(outputPath))

      // Write file
      const writer = fs.createWriteStream(outputPath)
      response.data.pipe(writer)

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve())
        writer.on('error', reject)
      })

      spinner.succeed('Export completed!')
      console.log(chalk.green(`✅ Export saved to: ${outputPath}`))
      
      // Show file info
      const stats = await fs.stat(outputPath)
      console.log(chalk.blue(`📁 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`))

    } catch (error) {
      spinner.fail('Export failed')
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
    }
  })

// List available exports
exportCommand
  .command('list')
  .description('List available exports')
  .option('-t, --type <type>', 'Filter by type (project|crawl)')
  .action(async (options) => {
    const spinner = ora('Loading available exports...').start()
    
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

      // Get projects
      if (!options.type || options.type === 'project') {
        const projects = await api.listProjects(config.userId!)
        
        if (projects.projects.length > 0) {
          console.log(chalk.cyan('\n📁 Available Projects:'))
          projects.projects.forEach((project: any) => {
            console.log(`  ${chalk.green(project.name)}`)
            console.log(`    ID: ${project.id}`)
            console.log(`    Description: ${project.description || 'No description'}`)
            console.log(`    Created: ${new Date(project.created_at).toLocaleDateString()}`)
            console.log('')
          })
        }
      }

      // Get crawls
      if (!options.type || options.type === 'crawl') {
        const crawls = await api.listCrawls(config.userId!)
        
        if (crawls.crawls.length > 0) {
          console.log(chalk.cyan('\n🕷️  Available Crawls:'))
          crawls.crawls.forEach((crawl: any) => {
            console.log(`  ${chalk.blue(crawl.root_url)}`)
            console.log(`    ID: ${crawl.id}`)
            console.log(`    Project: ${crawl.project_name}`)
            console.log(`    Status: ${getStatusColor(crawl.status)}`)
            console.log(`    Pages: ${crawl.pages_crawled || 0}`)
            console.log(`    Created: ${new Date(crawl.created_at).toLocaleDateString()}`)
            console.log('')
          })
        }
      }

      spinner.succeed('Export list loaded')

    } catch (error) {
      spinner.fail('Failed to load exports')
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
    }
  })

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
