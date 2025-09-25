/**
 * Analysis File Writer Service
 * Handles secure JSON file output for frontend-backend analysis results
 * Implements atomic writing, metadata generation, and security validation
 */

import { promises as fs } from 'fs'
import { join, resolve, basename } from 'path'
import { createHash } from 'crypto'
import type { AnalysisFileMetadata, FileCleanupConfig } from '../types/frontend-types'

export interface FileWriteResult {
  success: boolean
  filename: string
  filepath: string
  size: number
  error?: string
}

export interface FileWriteOptions {
  includeMetadata: boolean
  createSymlink: boolean
  validateJSON: boolean
  mode?: 'single' | 'sector' | 'multiple'
  symbols?: string[]
  sector?: string
}

export class AnalysisFileWriter {
  private readonly outputDir: string
  private readonly maxFileSize: number = 10 * 1024 * 1024 // 10MB limit
  private readonly allowedExtensions = ['.json']

  constructor(outputDir: string = 'public/analysis-results') {
    // Resolve to absolute path and ensure it's within project bounds
    this.outputDir = resolve(process.cwd(), outputDir)

    // Security check: ensure output directory is within project
    if (!this.outputDir.startsWith(process.cwd())) {
      throw new Error('Security violation: Output directory must be within project root')
    }
  }

  /**
   * Write analysis results to JSON file with atomic operation
   */
  async writeAnalysisFile(
    analysisData: any,
    options: FileWriteOptions
  ): Promise<FileWriteResult> {
    try {
      // Ensure output directory exists
      await this.ensureOutputDirectory()

      // Validate input data
      await this.validateAnalysisData(analysisData)

      // Generate secure filename
      const filename = this.generateFileName(options)
      const filepath = join(this.outputDir, filename)
      const tempFilepath = `${filepath}.tmp`

      // Prepare file content with metadata
      const fileContent = await this.prepareFileContent(analysisData, options)

      // Validate file size
      if (Buffer.byteLength(fileContent) > this.maxFileSize) {
        throw new Error(`File size exceeds maximum allowed (${this.maxFileSize} bytes)`)
      }

      // Atomic write: write to temp file first
      await fs.writeFile(tempFilepath, fileContent, {
        encoding: 'utf8',
        mode: 0o644 // Read/write for owner, read for group and others
      })

      // Validate written JSON
      if (options.validateJSON) {
        await this.validateWrittenFile(tempFilepath)
      }

      // Atomic move to final location
      await fs.rename(tempFilepath, filepath)

      // Create symlink to latest analysis if requested
      if (options.createSymlink) {
        await this.createLatestSymlink(filename)
      }

      // Get file stats
      const stats = await fs.stat(filepath)

      console.log(`✅ Analysis file written successfully: ${filename} (${stats.size} bytes)`)

      return {
        success: true,
        filename,
        filepath: filepath.replace(process.cwd(), ''), // Return relative path
        size: stats.size
      }

    } catch (error) {
      console.error('File write error:', error)

      return {
        success: false,
        filename: '',
        filepath: '',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown file write error'
      }
    }
  }

  /**
   * Create symlink to latest analysis file
   */
  private async createLatestSymlink(filename: string): Promise<void> {
    const symlinkPath = join(this.outputDir, 'latest-analysis.json')

    try {
      // Remove existing symlink if it exists
      try {
        await fs.unlink(symlinkPath)
      } catch (error) {
        // Ignore if file doesn't exist
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }

      // Create new symlink
      await fs.symlink(filename, symlinkPath)
    } catch (error) {
      console.warn('Failed to create symlink:', error)
      // Don't fail the entire operation for symlink issues
    }
  }

  /**
   * Generate secure filename with timestamp and hash
   */
  private generateFileName(options: FileWriteOptions): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const mode = options.mode || 'unknown'

    // Create content hash for uniqueness
    const hashContent = JSON.stringify({
      mode: options.mode,
      symbols: options.symbols,
      sector: options.sector,
      timestamp: Date.now()
    })

    const hash = createHash('md5').update(hashContent).digest('hex').substring(0, 8)

    return `analysis-${timestamp}-${mode}-${hash}.json`
  }

  /**
   * Prepare file content with optional metadata
   */
  private async prepareFileContent(
    analysisData: any,
    options: FileWriteOptions
  ): Promise<string> {
    let content: any

    if (options.includeMetadata) {
      // Include comprehensive metadata
      const metadata: AnalysisFileMetadata = {
        analysisType: 'stock-analysis',
        mode: (options.mode as 'single' | 'sector' | 'multiple') || 'single',
        symbols: options.symbols,
        sector: options.sector,
        timestamp: Date.now(),
        processingTime: analysisData.metadata?.processingTime || 0,
        dataSourcesUsed: analysisData.metadata?.sources || [],
        serviceHealthSnapshot: analysisData.metadata?.serviceHealth || {},
        resultCount: analysisData.stocks?.length || 0,
        fileVersion: '1.0',
        apiVersion: process.env.API_VERSION || '1.0.0'
      }

      content = {
        metadata,
        analysis: analysisData
      }
    } else {
      content = analysisData
    }

    return JSON.stringify(content, null, 2)
  }

  /**
   * Validate analysis data structure
   */
  private async validateAnalysisData(data: any): Promise<void> {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid analysis data: must be an object')
    }

    // Basic structure validation
    if (!data.stocks && !data.data?.stocks) {
      throw new Error('Invalid analysis data: missing stocks array')
    }

    // Security validation - no executable content
    const jsonString = JSON.stringify(data)

    // Check for potentially malicious content
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /Function\s*\(/i
    ]

    for (const pattern of maliciousPatterns) {
      if (pattern.test(jsonString)) {
        throw new Error('Security violation: Potentially malicious content detected')
      }
    }
  }

  /**
   * Validate written JSON file
   */
  private async validateWrittenFile(filepath: string): Promise<void> {
    try {
      const content = await fs.readFile(filepath, 'utf8')
      JSON.parse(content) // Validate JSON structure
    } catch (error) {
      throw new Error(`File validation failed: ${error instanceof Error ? error.message : 'Invalid JSON'}`)
    }
  }

  /**
   * Ensure output directory exists with proper permissions
   */
  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.access(this.outputDir)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Directory doesn't exist, create it
        await fs.mkdir(this.outputDir, {
          recursive: true,
          mode: 0o755 // rwxr-xr-x
        })
        console.log(`Created analysis output directory: ${this.outputDir}`)
      } else {
        throw error
      }
    }
  }

  /**
   * Get list of analysis files
   */
  async listAnalysisFiles(): Promise<{ filename: string; size: number; created: Date }[]> {
    try {
      const files = await fs.readdir(this.outputDir)
      const analysisFiles = files
        .filter(file => file.startsWith('analysis-') && file.endsWith('.json'))
        .filter(file => file !== 'latest-analysis.json') // Exclude symlink

      const fileList = await Promise.all(
        analysisFiles.map(async (filename) => {
          const filepath = join(this.outputDir, filename)
          const stats = await fs.stat(filepath)

          return {
            filename,
            size: stats.size,
            created: stats.birthtime
          }
        })
      )

      // Sort by creation time, newest first
      return fileList.sort((a, b) => b.created.getTime() - a.created.getTime())
    } catch (error) {
      console.error('Error listing analysis files:', error)
      return []
    }
  }

  /**
   * Read analysis file
   */
  async readAnalysisFile(filename: string): Promise<any> {
    // Security validation
    if (!filename || typeof filename !== 'string') {
      throw new Error('Invalid filename')
    }

    // Prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new Error('Security violation: Invalid filename characters')
    }

    // Check allowed extension
    if (!this.allowedExtensions.some(ext => filename.endsWith(ext))) {
      throw new Error('Invalid file extension')
    }

    const filepath = join(this.outputDir, filename)

    try {
      const content = await fs.readFile(filepath, 'utf8')
      return JSON.parse(content)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('File not found')
      }
      throw error
    }
  }

  /**
   * Clean up old analysis files
   */
  async cleanupOldFiles(config: FileCleanupConfig): Promise<number> {
    try {
      const files = await this.listAnalysisFiles()

      if (files.length <= config.maxFiles && config.retainLatest) {
        return 0 // No cleanup needed
      }

      const now = new Date()
      const maxAge = config.maxAgeDays * 24 * 60 * 60 * 1000 // Convert to milliseconds

      let filesToDelete = files.filter(file => {
        const age = now.getTime() - file.created.getTime()
        return age > maxAge
      })

      // If still too many files, delete oldest ones
      if (files.length > config.maxFiles) {
        const excess = files.length - config.maxFiles
        const oldestFiles = files.slice(-excess)
        filesToDelete = [...new Set([...filesToDelete, ...oldestFiles])]
      }

      // Always retain the latest file if configured
      if (config.retainLatest && filesToDelete.length > 0) {
        const latestFile = files[0] // Already sorted by creation time
        filesToDelete = filesToDelete.filter(f => f.filename !== latestFile.filename)
      }

      // Delete files
      for (const file of filesToDelete) {
        const filepath = join(this.outputDir, file.filename)
        await fs.unlink(filepath)
      }

      console.log(`Cleaned up ${filesToDelete.length} old analysis files`)
      return filesToDelete.length

    } catch (error) {
      console.error('Error during file cleanup:', error)
      return 0
    }
  }

  /**
   * Get output directory path
   */
  getOutputDirectory(): string {
    return this.outputDir
  }
}