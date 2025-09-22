/**
 * Performance Test Reporter
 * Custom Jest reporter for performance test metrics and analysis
 */

const fs = require('fs')
const path = require('path')

class PerformanceReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig
    this.options = options
    this.results = []
    this.startTime = Date.now()
  }

  onRunStart() {
    console.log('\n🚀 Starting Performance Test Suite')
    console.log('=' * 60)
    this.startTime = Date.now()
  }

  onTestResult(test, testResult) {
    const { testFilePath, testResults } = testResult

    if (testFilePath.includes('performance.test')) {
      // Extract performance metrics from test results
      testResults.forEach(result => {
        if (result.status === 'passed' || result.status === 'failed') {
          const performanceData = {
            testName: result.title,
            duration: result.duration,
            status: result.status,
            memoryUsage: this.extractMemoryUsage(result),
            timestamp: Date.now()
          }

          this.results.push(performanceData)
        }
      })
    }
  }

  onRunComplete(contexts, results) {
    const totalDuration = Date.now() - this.startTime
    const passedTests = this.results.filter(r => r.status === 'passed').length
    const failedTests = this.results.filter(r => r.status === 'failed').length

    // Generate performance summary
    this.generatePerformanceSummary(totalDuration, passedTests, failedTests)

    // Save detailed results
    this.savePerformanceResults()

    // Generate performance report
    this.generatePerformanceReport()
  }

  extractMemoryUsage(result) {
    // Extract memory usage from test output if available
    const memoryPattern = /Memory delta: ([\d.]+)MB/
    const match = result.fullName?.match?.(memoryPattern)
    return match ? parseFloat(match[1]) : null
  }

  generatePerformanceSummary(totalDuration, passedTests, failedTests) {
    console.log('\n' + '='.repeat(60))
    console.log('🎯 PERFORMANCE TEST SUMMARY')
    console.log('='.repeat(60))

    console.log(`⏱️ Total Execution Time: ${this.formatDuration(totalDuration)}`)
    console.log(`✅ Passed Tests: ${passedTests}`)
    console.log(`❌ Failed Tests: ${failedTests}`)
    console.log(`📊 Success Rate: ${Math.round((passedTests / (passedTests + failedTests)) * 100)}%`)

    // Performance metrics analysis
    const durations = this.results.map(r => r.duration).filter(d => d != null)
    if (durations.length > 0) {
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
      const maxDuration = Math.max(...durations)
      const minDuration = Math.min(...durations)

      console.log(`\n📈 Performance Metrics:`)
      console.log(`   Average Response Time: ${Math.round(avgDuration)}ms`)
      console.log(`   Max Response Time: ${Math.round(maxDuration)}ms`)
      console.log(`   Min Response Time: ${Math.round(minDuration)}ms`)

      // Performance targets analysis
      const targetMs = global.PERFORMANCE_CONFIG?.TARGET_RESPONSE_TIME_MS || 500
      const withinTarget = durations.filter(d => d <= targetMs).length
      const targetPercentage = Math.round((withinTarget / durations.length) * 100)

      console.log(`🎯 Target Compliance (<${targetMs}ms): ${targetPercentage}% (${withinTarget}/${durations.length})`)
    }

    // Memory usage analysis
    const memoryUsages = this.results.map(r => r.memoryUsage).filter(m => m != null)
    if (memoryUsages.length > 0) {
      const avgMemory = memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length
      const maxMemory = Math.max(...memoryUsages)

      console.log(`\n🧠 Memory Usage:`)
      console.log(`   Average Memory Delta: ${Math.round(avgMemory * 100) / 100}MB`)
      console.log(`   Max Memory Delta: ${Math.round(maxMemory * 100) / 100}MB`)

      const memoryThreshold = global.PERFORMANCE_CONFIG?.MEMORY_LEAK_THRESHOLD_MB || 50
      const withinMemoryTarget = memoryUsages.filter(m => m <= memoryThreshold).length
      const memoryTargetPercentage = Math.round((withinMemoryTarget / memoryUsages.length) * 100)

      console.log(`🎯 Memory Efficiency (<${memoryThreshold}MB): ${memoryTargetPercentage}% (${withinMemoryTarget}/${memoryUsages.length})`)
    }

    console.log('='.repeat(60))
  }

  savePerformanceResults() {
    const outputDir = path.join(process.cwd(), 'docs', 'test-output', 'performance')

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Save raw results
    const resultsFile = path.join(outputDir, `performance-results-${Date.now()}.json`)
    fs.writeFileSync(resultsFile, JSON.stringify({
      timestamp: Date.now(),
      results: this.results,
      summary: this.generateSummaryData()
    }, null, 2))

    console.log(`📁 Performance results saved to: ${resultsFile}`)
  }

  generatePerformanceReport() {
    const outputDir = path.join(process.cwd(), 'docs', 'test-output', 'performance')
    const reportFile = path.join(outputDir, `performance-report-${new Date().toISOString().split('T')[0]}.md`)

    const report = this.createMarkdownReport()
    fs.writeFileSync(reportFile, report)

    console.log(`📊 Performance report generated: ${reportFile}`)
  }

  createMarkdownReport() {
    const durations = this.results.map(r => r.duration).filter(d => d != null)
    const memoryUsages = this.results.map(r => r.memoryUsage).filter(m => m != null)

    return `# Performance Test Report

Generated: ${new Date().toISOString()}

## Summary

- **Total Tests**: ${this.results.length}
- **Passed**: ${this.results.filter(r => r.status === 'passed').length}
- **Failed**: ${this.results.filter(r => r.status === 'failed').length}

## Performance Metrics

${durations.length > 0 ? `
### Response Time Analysis
- **Average**: ${Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)}ms
- **Max**: ${Math.max(...durations)}ms
- **Min**: ${Math.min(...durations)}ms
` : ''}

${memoryUsages.length > 0 ? `
### Memory Usage Analysis
- **Average Memory Delta**: ${Math.round(memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length * 100) / 100}MB
- **Max Memory Delta**: ${Math.max(...memoryUsages)}MB
` : ''}

## Detailed Results

${this.results.map(result => `
### ${result.testName}
- **Status**: ${result.status === 'passed' ? '✅ Passed' : '❌ Failed'}
- **Duration**: ${result.duration || 'N/A'}ms
- **Memory Usage**: ${result.memoryUsage || 'N/A'}MB
`).join('\n')}

## Recommendations

${this.generateRecommendations()}
`
  }

  generateRecommendations() {
    const durations = this.results.map(r => r.duration).filter(d => d != null)
    const targetMs = global.PERFORMANCE_CONFIG?.TARGET_RESPONSE_TIME_MS || 500
    const slowTests = durations.filter(d => d > targetMs)

    let recommendations = []

    if (slowTests.length > 0) {
      recommendations.push(`- **Performance**: ${slowTests.length} tests exceeded the ${targetMs}ms target. Consider optimizing API calls and caching strategies.`)
    }

    const memoryUsages = this.results.map(r => r.memoryUsage).filter(m => m != null)
    const memoryThreshold = global.PERFORMANCE_CONFIG?.MEMORY_LEAK_THRESHOLD_MB || 50
    const highMemoryTests = memoryUsages.filter(m => m > memoryThreshold)

    if (highMemoryTests.length > 0) {
      recommendations.push(`- **Memory**: ${highMemoryTests.length} tests exceeded the ${memoryThreshold}MB memory threshold. Review memory cleanup and garbage collection.`)
    }

    if (recommendations.length === 0) {
      recommendations.push('- All performance tests are meeting their targets. Great work!')
    }

    return recommendations.join('\n')
  }

  generateSummaryData() {
    const durations = this.results.map(r => r.duration).filter(d => d != null)
    const memoryUsages = this.results.map(r => r.memoryUsage).filter(m => m != null)

    return {
      totalTests: this.results.length,
      passedTests: this.results.filter(r => r.status === 'passed').length,
      failedTests: this.results.filter(r => r.status === 'failed').length,
      performance: durations.length > 0 ? {
        averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        maxDuration: Math.max(...durations),
        minDuration: Math.min(...durations)
      } : null,
      memory: memoryUsages.length > 0 ? {
        averageUsage: memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length,
        maxUsage: Math.max(...memoryUsages)
      } : null
    }
  }

  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`
    } else if (ms < 60000) {
      return `${Math.round(ms / 1000 * 10) / 10}s`
    } else {
      const minutes = Math.floor(ms / 60000)
      const seconds = Math.round((ms % 60000) / 1000)
      return `${minutes}m ${seconds}s`
    }
  }
}

module.exports = PerformanceReporter