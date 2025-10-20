import { Command } from 'commander'
import inquirer from 'inquirer'
import chalk from 'chalk'
import ora from 'ora'
import { WebToContextAPI } from '../api-client'

export const authCommand = new Command('auth')
  .description('Authentication commands for CLI access')

// Login command
authCommand
  .command('login')
  .description('Authenticate with user account')
  .option('-c, --client-id <id>', 'OAuth client ID')
  .option('-u, --user-id <id>', 'User ID to authenticate as')
  .action(async (options) => {
    const spinner = ora('Initializing authentication...').start()
    
    try {
      const api = new WebToContextAPI({
        apiUrl: process.env.WEB_TO_CONTEXT_API_URL || 'http://localhost:3000'
      })

      // Load existing config
      await api.loadConfig()

      // If no client ID provided, prompt for registration
      if (!options.clientId) {
        spinner.text = 'Setting up CLI client...'
        
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Application name:',
            default: 'My CLI Application'
          },
          {
            type: 'input',
            name: 'description',
            message: 'Application description:',
            default: 'CLI tool for accessing user data'
          },
          {
            type: 'input',
            name: 'redirectUri',
            message: 'Redirect URI:',
            default: 'http://localhost:8080/callback'
          },
          {
            type: 'checkbox',
            name: 'scopes',
            message: 'Select permissions:',
            choices: [
              { name: 'Read projects', value: 'read:projects' },
              { name: 'Read crawls', value: 'read:crawls' },
              { name: 'Read chunks', value: 'read:chunks' },
              { name: 'Search chunks', value: 'search:chunks' },
              { name: 'Export data', value: 'export:data' },
              { name: 'Read metadata', value: 'read:metadata' }
            ],
            default: ['read:projects', 'read:crawls', 'search:chunks']
          }
        ])

        const client = await api.registerClient(
          answers.name,
          answers.description,
          answers.redirectUri,
          answers.scopes
        )

        api.updateConfig({
          clientId: client.client.clientId,
          clientSecret: client.client.clientSecret
        })

        spinner.succeed('CLI client registered successfully!')
        console.log(chalk.green(`Client ID: ${client.client.clientId}`))
        console.log(chalk.yellow('⚠️  Save your client secret securely!'))
      } else {
        api.updateConfig({ clientId: options.clientId })
      }

      // Get user ID
      if (!options.userId) {
        const { userId } = await inquirer.prompt([
          {
            type: 'input',
            name: 'userId',
            message: 'User ID to authenticate as:',
            validate: (input) => input.length > 0 || 'User ID is required'
          }
        ])
        api.updateConfig({ userId })
      } else {
        api.updateConfig({ userId: options.userId })
      }

      // Request permission
      spinner.text = 'Requesting user permission...'
      
      const config = api.getConfig()
      const permission = await api.grantPermission(
        config.userId!,
        config.clientId!,
        ['read:projects', 'read:crawls', 'search:chunks', 'export:data'],
        {},
        30 * 24 * 60 * 60 // 30 days
      )

      // Generate access token (simplified for demo)
      const accessToken = Buffer.from(`${config.clientId}:${Date.now()}:${Math.random()}`).toString('base64')
      api.updateConfig({ accessToken })

      // Save configuration
      await api.saveConfig()

      spinner.succeed('Authentication successful!')
      console.log(chalk.green('✅ You are now authenticated and can use CLI commands'))

    } catch (error) {
      spinner.fail('Authentication failed')
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

// Logout command
authCommand
  .command('logout')
  .description('Logout and clear stored credentials')
  .action(async () => {
    const spinner = ora('Logging out...').start()
    
    try {
      const api = new WebToContextAPI({
        apiUrl: process.env.WEB_TO_CONTEXT_API_URL || 'http://localhost:3000'
      })

      await api.loadConfig()
      await api.clearConfig()

      spinner.succeed('Logged out successfully!')
    } catch (error) {
      spinner.fail('Logout failed')
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
    }
  })

// Status command
authCommand
  .command('status')
  .description('Show authentication status')
  .action(async () => {
    try {
      const api = new WebToContextAPI({
        apiUrl: process.env.WEB_TO_CONTEXT_API_URL || 'http://localhost:3000'
      })

      await api.loadConfig()
      const config = api.getConfig()

      if (api.isAuthenticated()) {
        console.log(chalk.green('✅ Authenticated'))
        console.log(`User ID: ${config.userId}`)
        console.log(`Client ID: ${config.clientId}`)
        console.log(`API URL: ${config.apiUrl}`)
      } else {
        console.log(chalk.red('❌ Not authenticated'))
        console.log('Run: web-to-context auth login')
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
    }
  })

// Permissions command
authCommand
  .command('permissions')
  .description('Manage user permissions')
  .option('-l, --list', 'List current permissions')
  .option('-r, --revoke <clientId>', 'Revoke permission for client')
  .action(async (options) => {
    try {
      const api = new WebToContextAPI({
        apiUrl: process.env.WEB_TO_CONTEXT_API_URL || 'http://localhost:3000'
      })

      await api.loadConfig()

      if (!api.isAuthenticated()) {
        console.error(chalk.red('❌ Not authenticated. Run: web-to-context auth login'))
        return
      }

      const config = api.getConfig()

      if (options.list) {
        const permissions = await api.getPermissions(config.userId)
        
        if (permissions.permissions.length === 0) {
          console.log(chalk.yellow('No permissions found'))
          return
        }

        console.log(chalk.green('Current permissions:'))
        permissions.permissions.forEach((perm: any) => {
          console.log(`\n${chalk.cyan(perm.clientName)}`)
          console.log(`  Description: ${perm.clientDescription}`)
          console.log(`  Scopes: ${perm.scopes.join(', ')}`)
          console.log(`  Expires: ${perm.expiresAt ? new Date(perm.expiresAt).toLocaleString() : 'Never'}`)
          console.log(`  Last used: ${perm.lastUsed ? new Date(perm.lastUsed).toLocaleString() : 'Never'}`)
        })
      } else if (options.revoke) {
        await api.revokePermission(undefined, options.revoke)
        console.log(chalk.green(`✅ Permission revoked for client: ${options.revoke}`))
      } else {
        console.log(chalk.yellow('Use --list to view permissions or --revoke <clientId> to revoke'))
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
    }
  })
