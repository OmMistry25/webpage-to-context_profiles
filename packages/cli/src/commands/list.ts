import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { WebToContextAPI } from '../api-client'

export const listCommand = new Command('list')
  .description('List user data')

// List projects
listCommand
  .command('projects')
  .description('List user projects')
  .option('-f, --format <format>', 'Output format', 'table')
  .action(async (options) => {
    const spinner = ora('Loading projects...').start()
    
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
      const projects = await api.listProjects(config.userId!)

      spinner.succeed(`Found ${projects.projects.length} projects`)

      if (projects.projects.length === 0) {
        console.log(chalk.yellow('No projects found'))
        return
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(projects, null, 2))
      } else {
        displayProjects(projects.projects)
      }

    } catch (error) {
      spinner.fail('Failed to load projects')
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
    }
  })

// List crawls
listCommand
  .command('crawls')
  .description('List user crawls')
  .option('-p, --project-id <id>', 'Filter by project ID')
  .option('-f, --format <format>', 'Output format', 'table')
  .action(async (options) => {
    const spinner = ora('Loading crawls...').start()
    
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
      const crawls = await api.listCrawls(config.userId!, options.projectId)

      spinner.succeed(`Found ${crawls.crawls.length} crawls`)

      if (crawls.crawls.length === 0) {
        console.log(chalk.yellow('No crawls found'))
        return
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(crawls, null, 2))
      } else {
        displayCrawls(crawls.crawls)
      }

    } catch (error) {
      spinner.fail('Failed to load crawls')
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
    }
  })

function displayProjects(projects: any[]) {
  console.log(chalk.cyan('\n📁 Projects:'))
  console.log('')
  
  projects.forEach((project, index) => {
    console.log(`${index + 1}. ${chalk.green(project.name)}`)
    console.log(`   ID: ${project.id}`)
    console.log(`   Description: ${project.description || 'No description'}`)
    console.log(`   Created: ${new Date(project.created_at).toLocaleDateString()}`)
    console.log('')
  })
}

function displayCrawls(crawls: any[]) {
  console.log(chalk.cyan('\n🕷️  Crawls:'))
  console.log('')
  
  crawls.forEach((crawl, index) => {
    console.log(`${index + 1}. ${chalk.blue(crawl.root_url)}`)
    console.log(`   ID: ${crawl.id}`)
    console.log(`   Project: ${crawl.project_name}`)
    console.log(`   Status: ${getStatusColor(crawl.status)}`)
    console.log(`   Scope: ${crawl.scope}`)
    console.log(`   Max Depth: ${crawl.max_depth}`)
    console.log(`   Max Pages: ${crawl.max_pages}`)
    console.log(`   Pages Crawled: ${crawl.pages_crawled || 0}`)
    console.log(`   Created: ${new Date(crawl.created_at).toLocaleDateString()}`)
    console.log('')
  })
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
