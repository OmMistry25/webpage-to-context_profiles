#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { authCommand } from './commands/auth'
import { searchCommand } from './commands/search'
import { exportCommand } from './commands/export'
import { listCommand } from './commands/list'
import { configCommand } from './commands/config'

const program = new Command()

program
  .name('web-to-context')
  .description('CLI for accessing user data with permission')
  .version('0.1.0')

// Add commands
program.addCommand(authCommand)
program.addCommand(searchCommand)
program.addCommand(exportCommand)
program.addCommand(listCommand)
program.addCommand(configCommand)

// Global error handler
program.exitOverride()

try {
  program.parse()
} catch (error) {
  if (error instanceof Error) {
    console.error(chalk.red('Error:'), error.message)
    process.exit(1)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason)
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error)
  process.exit(1)
})
