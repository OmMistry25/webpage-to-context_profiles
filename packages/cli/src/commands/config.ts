import { Command } from 'commander'
import chalk from 'chalk'
import { WebToContextAPI } from '../api-client'

export const configCommand = new Command('config')
  .description('Configuration management')

// Show current config
configCommand
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    try {
      const api = new WebToContextAPI({
        apiUrl: process.env.WEB_TO_CONTEXT_API_URL || 'http://localhost:3000'
      })

      await api.loadConfig()
      const config = api.getConfig()

      console.log(chalk.cyan('Current Configuration:'))
      console.log('')
      console.log(`API URL: ${config.apiUrl}`)
      console.log(`Client ID: ${config.clientId || 'Not set'}`)
      console.log(`User ID: ${config.userId || 'Not set'}`)
      console.log(`Authenticated: ${api.isAuthenticated() ? chalk.green('Yes') : chalk.red('No')}`)
      
      if (config.clientSecret) {
        console.log(`Client Secret: ${config.clientSecret.substring(0, 8)}...`)
      }

    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
    }
  })

// Set configuration
configCommand
  .command('set')
  .description('Set configuration values')
  .option('-u, --api-url <url>', 'Set API URL')
  .option('-c, --client-id <id>', 'Set client ID')
  .option('-s, --client-secret <secret>', 'Set client secret')
  .option('-i, --user-id <id>', 'Set user ID')
  .action(async (options) => {
    try {
      const api = new WebToContextAPI({
        apiUrl: process.env.WEB_TO_CONTEXT_API_URL || 'http://localhost:3000'
      })

      await api.loadConfig()

      const updates: any = {}
      
      if (options.apiUrl) updates.apiUrl = options.apiUrl
      if (options.clientId) updates.clientId = options.clientId
      if (options.clientSecret) updates.clientSecret = options.clientSecret
      if (options.userId) updates.userId = options.userId

      if (Object.keys(updates).length === 0) {
        console.log(chalk.yellow('No configuration values provided'))
        return
      }

      api.updateConfig(updates)
      await api.saveConfig()

      console.log(chalk.green('✅ Configuration updated successfully'))

    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
    }
  })

// Clear configuration
configCommand
  .command('clear')
  .description('Clear all configuration')
  .option('-f, --force', 'Force clear without confirmation')
  .action(async (options) => {
    try {
      if (!options.force) {
        const { confirm } = await import('inquirer').then(m => m.default.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to clear all configuration?',
            default: false
          }
        ]))

        if (!confirm) {
          console.log(chalk.yellow('Configuration clear cancelled'))
          return
        }
      }

      const api = new WebToContextAPI({
        apiUrl: process.env.WEB_TO_CONTEXT_API_URL || 'http://localhost:3000'
      })

      await api.clearConfig()

      console.log(chalk.green('✅ Configuration cleared successfully'))

    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
    }
  })
