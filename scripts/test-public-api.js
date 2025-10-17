#!/usr/bin/env node

/**
 * Test script for the public API endpoints
 * This script tests the complete flow: create API key, start crawl, check status, export, search
 */

const API_BASE_URL = 'http://localhost:3005/api/v1'

// Test configuration
const TEST_URL = 'https://example.com'
const TEST_USER_EMAIL = 'test@example.com' // You'll need to replace this with a real user
const TEST_USER_PASSWORD = 'testpassword' // You'll need to replace this with a real password

let apiKey = null
let crawlId = null

async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  }

  console.log(`\n🔍 ${config.method || 'GET'} ${url}`)
  
  try {
    const response = await fetch(url, config)
    const data = await response.json()
    
    console.log(`📊 Status: ${response.status}`)
    console.log(`📄 Response:`, JSON.stringify(data, null, 2))
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`)
    }
    
    return data
  } catch (error) {
    console.error(`❌ Request failed:`, error.message)
    throw error
  }
}

async function testAPIKeyCreation() {
  console.log('\n🚀 Testing API Key Creation...')
  
  try {
    // Note: This would normally require authentication
    // For testing, we'll assume you have a valid session
    console.log('⚠️  Note: API key creation requires authentication')
    console.log('   Please create an API key manually through the web interface')
    console.log('   and set the API_KEY environment variable')
    
    // Check if API key is provided via environment
    if (process.env.API_KEY) {
      apiKey = process.env.API_KEY
      console.log(`✅ Using API key from environment: ${apiKey.substring(0, 8)}...`)
      return true
    }
    
    console.log('❌ No API key provided. Set API_KEY environment variable or create one manually')
    return false
    
  } catch (error) {
    console.error('❌ API key creation test failed:', error.message)
    return false
  }
}

async function testCrawlCreation() {
  console.log('\n🚀 Testing Crawl Creation...')
  
  if (!apiKey) {
    console.log('❌ No API key available for testing')
    return false
  }
  
  try {
    const data = await makeRequest('/crawl', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        url: TEST_URL,
        max_depth: 2,
        max_pages: 10,
        scope: 'domain'
      })
    })
    
    crawlId = data.crawl.id
    console.log(`✅ Crawl created successfully: ${crawlId}`)
    return true
    
  } catch (error) {
    console.error('❌ Crawl creation test failed:', error.message)
    return false
  }
}

async function testCrawlStatus() {
  console.log('\n🚀 Testing Crawl Status...')
  
  if (!crawlId) {
    console.log('❌ No crawl ID available for testing')
    return false
  }
  
  try {
    const data = await makeRequest(`/crawl/${crawlId}/status`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })
    
    console.log(`✅ Crawl status retrieved: ${data.crawl.status}`)
    console.log(`   Progress: ${data.crawl.statistics.progress_percentage}%`)
    console.log(`   Pages: ${data.crawl.statistics.completed_pages}/${data.crawl.statistics.total_pages}`)
    
    return true
    
  } catch (error) {
    console.error('❌ Crawl status test failed:', error.message)
    return false
  }
}

async function testCrawlExport() {
  console.log('\n🚀 Testing Crawl Export...')
  
  if (!crawlId) {
    console.log('❌ No crawl ID available for testing')
    return false
  }
  
  try {
    const data = await makeRequest(`/crawl/${crawlId}/export?format=zip`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })
    
    console.log(`✅ Export created successfully: ${data.export.bundle_id}`)
    console.log(`   Download URL: ${data.export.download_url}`)
    
    return true
    
  } catch (error) {
    console.error('❌ Crawl export test failed:', error.message)
    return false
  }
}

async function testCrawlSearch() {
  console.log('\n🚀 Testing Crawl Search...')
  
  if (!crawlId) {
    console.log('❌ No crawl ID available for testing')
    return false
  }
  
  try {
    const data = await makeRequest(`/crawl/${crawlId}/search?q=example&limit=5`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })
    
    console.log(`✅ Search completed: ${data.search.total_results} results found`)
    console.log(`   Returned: ${data.search.results.length} results`)
    
    if (data.search.results.length > 0) {
      console.log(`   First result similarity: ${data.search.results[0].similarity_score}`)
    }
    
    return true
    
  } catch (error) {
    console.error('❌ Crawl search test failed:', error.message)
    return false
  }
}

async function testHealthCheck() {
  console.log('\n🚀 Testing Health Check...')
  
  try {
    // Test the existing health endpoint
    const response = await fetch('http://localhost:3005/api/health')
    const data = await response.json()
    console.log(`✅ Health check passed: ${data.status}`)
    return true
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message)
    return false
  }
}

async function runTests() {
  console.log('🧪 Starting Public API Tests')
  console.log('================================')
  
  const results = {
    healthCheck: false,
    apiKeyCreation: false,
    crawlCreation: false,
    crawlStatus: false,
    crawlExport: false,
    crawlSearch: false
  }
  
  // Test health check first
  results.healthCheck = await testHealthCheck()
  
  // Test API key creation
  results.apiKeyCreation = await testAPIKeyCreation()
  
  if (results.apiKeyCreation) {
    // Test crawl creation
    results.crawlCreation = await testCrawlCreation()
    
    if (results.crawlCreation) {
      // Test crawl status
      results.crawlStatus = await testCrawlStatus()
      
      // Test crawl export (might fail if crawl not completed)
      try {
        results.crawlExport = await testCrawlExport()
      } catch (error) {
        console.log('⚠️  Export test skipped (crawl might not be completed yet)')
      }
      
      // Test crawl search (might fail if crawl not completed)
      try {
        results.crawlSearch = await testCrawlSearch()
      } catch (error) {
        console.log('⚠️  Search test skipped (crawl might not be completed yet)')
      }
    }
  }
  
  // Print summary
  console.log('\n📊 Test Results Summary')
  console.log('=======================')
  console.log(`Health Check: ${results.healthCheck ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`API Key Creation: ${results.apiKeyCreation ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Crawl Creation: ${results.crawlCreation ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Crawl Status: ${results.crawlStatus ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Crawl Export: ${results.crawlExport ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Crawl Search: ${results.crawlSearch ? '✅ PASS' : '❌ FAIL'}`)
  
  const passedTests = Object.values(results).filter(Boolean).length
  const totalTests = Object.keys(results).length
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`)
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Public API is working correctly.')
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.')
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error)
}

module.exports = {
  runTests,
  testAPIKeyCreation,
  testCrawlCreation,
  testCrawlStatus,
  testCrawlExport,
  testCrawlSearch,
  testHealthCheck
}
