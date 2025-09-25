# Frontend-Backend Wiring Implementation Todos

**Created**: September 25, 2025
**Context**: Implementation tasks for connecting frontend analysis interface to backend StockSelectionService
**Target**: Sub-3-second analysis completion with comprehensive error handling and JSON file output

---

## Phase 1: API Endpoint Creation (Estimated: 45 minutes)

### 1.1 Core Endpoint Setup
**Todo**: Create API endpoint route file at `/app/api/stocks/analysis-frontend/route.ts`
**Time Estimate**: 10 minutes
**Dependencies**: None
**Files to Create**:
- `/app/api/stocks/analysis-frontend/route.ts`

**Implementation Details**:
- Copy base structure from existing `/app/api/stocks/analyze/route.ts`
- Implement NextRequest/NextResponse pattern
- Add CORS headers for frontend integration
- Include request logging for debugging

**Test Requirements**:
- Basic GET request returns health check status
- POST request accepts valid JSON payload
- Returns proper HTTP status codes

---

### 1.2 Request Validation System
**Todo**: Implement POST handler with request validation using zod schema
**Time Estimate**: 15 minutes
**Dependencies**: 1.1 Complete
**Files to Modify**:
- `/app/api/stocks/analysis-frontend/route.ts`

**Implementation Details**:
- Create `FrontendAnalysisRequestSchema` using zod
- Validate mode: 'single' | 'sector' | 'multiple'
- Validate sector object structure (id, label, category)
- Validate symbols array format
- Validate options object with defaults

**Key Functions to Implement**:
```typescript
const FrontendAnalysisRequestSchema = z.object({
  mode: z.enum(['single', 'sector', 'multiple']),
  sector: z.object({
    id: z.string(),
    label: z.string(),
    category: z.enum(['sector', 'index', 'etf'])
  }).optional(),
  symbols: z.array(z.string()).optional(),
  options: z.object({
    useRealTimeData: z.boolean().default(true),
    includeSentiment: z.boolean().default(true),
    includeNews: z.boolean().default(true),
    timeout: z.number().default(30000)
  }).optional()
})
```

**Test Requirements**:
- Valid requests pass validation
- Invalid requests return 400 with specific error messages
- Missing required fields handled gracefully

---

### 1.3 Security Integration
**Todo**: Add SecurityValidator integration for OWASP protection
**Time Estimate**: 8 minutes
**Dependencies**: 1.2 Complete
**Files to Modify**:
- `/app/api/stocks/analysis-frontend/route.ts`

**Implementation Details**:
- Import existing `SecurityValidator` from `/app/services/security/`
- Validate all input symbols using `validateSymbol()` function
- Sanitize sector labels and IDs
- Implement rate limiting check
- Add request size validation

**Key Functions to Use**:
```typescript
import { SecurityValidator } from '@/services/security/SecurityValidator'

// Validate each symbol in the request
const validatedSymbols = symbols.map(symbol => {
  const validation = SecurityValidator.validateSymbol(symbol)
  if (!validation.isValid) {
    throw new Error(`Invalid symbol: ${symbol}`)
  }
  return validation.sanitized
})
```

**Test Requirements**:
- Malicious symbols rejected
- Rate limiting enforced
- Input sanitization working

---

### 1.4 Service Integration
**Todo**: Integrate StockSelectionService initialization and processing
**Time Estimate**: 12 minutes
**Dependencies**: 1.3 Complete
**Files to Modify**:
- `/app/api/stocks/analysis-frontend/route.ts`

**Implementation Details**:
- Import and initialize `StockSelectionService`
- Map frontend request format to existing service methods
- Handle single stock analysis via `analyzeStock()`
- Handle sector analysis via `analyzeSector()`
- Handle multiple stocks via `analyzeMultipleStocks()`
- Preserve all existing error handling patterns

**Key Functions to Implement**:
```typescript
const processAnalysisRequest = async (validatedRequest: FrontendAnalysisRequest) => {
  const stockSelection = new StockSelectionService()
  await stockSelection.initialize()

  switch (validatedRequest.mode) {
    case 'single':
      return await stockSelection.analyzeStock(validatedRequest.symbols[0])
    case 'sector':
      return await stockSelection.analyzeSector(validatedRequest.sector.id)
    case 'multiple':
      return await stockSelection.analyzeMultipleStocks(validatedRequest.symbols)
  }
}
```

**Test Requirements**:
- All three analysis modes working
- Service initialization errors handled
- Analysis results properly structured

---

## Phase 2: File Output System (Estimated: 30 minutes)

### 2.1 Directory Structure Setup
**Todo**: Create public/analysis-results directory structure
**Time Estimate**: 5 minutes
**Dependencies**: None
**Files to Create**:
- `public/analysis-results/` (directory)
- `public/analysis-results/metadata/` (directory)
- `public/analysis-results/.gitkeep`

**Implementation Details**:
- Create directory structure in public/ for web accessibility
- Add .gitkeep to ensure directories exist in git
- Set proper permissions for write access
- Create README.md explaining file format

**Test Requirements**:
- Directories exist and are writable
- Web server can serve files from public/analysis-results/
- Directory permissions correct

---

### 2.2 Atomic File Writing System
**Todo**: Create JSON file output system with atomic writing
**Time Estimate**: 15 minutes
**Dependencies**: 2.1 Complete
**Files to Create**:
- `/app/services/file-output/AnalysisFileWriter.ts`

**Implementation Details**:
- Implement atomic file writing to prevent corruption
- Use temporary files with rename operation
- Add comprehensive error handling for disk issues
- Include file size validation
- Generate unique analysis IDs

**Key Functions to Implement**:
```typescript
export class AnalysisFileWriter {
  async writeAnalysisResults(
    analysisData: AnalysisResult,
    metadata: AnalysisMetadata
  ): Promise<string> {
    const timestamp = Date.now()
    const analysisId = `frontend_${timestamp}_${generateHash()}`
    const fileName = `analysis-${timestamp}-${metadata.mode}.json`
    const tempFileName = `${fileName}.tmp`

    // Write to temp file first
    await this.writeTemporaryFile(tempFileName, analysisData)
    // Atomic rename
    await this.moveFile(tempFileName, fileName)
    // Update latest symlink
    await this.updateLatestSymlink(fileName)

    return fileName
  }
}
```

**Test Requirements**:
- Files written atomically without corruption
- Temporary files cleaned up on errors
- Symlinks updated correctly

---

### 2.3 File Naming and Metadata
**Todo**: Implement file naming convention with timestamps and symlinks
**Time Estimate**: 10 minutes
**Dependencies**: 2.2 Complete
**Files to Modify**:
- `/app/services/file-output/AnalysisFileWriter.ts`

**Implementation Details**:
- Implement naming pattern: `analysis-{timestamp}-{mode}-{hash}.json`
- Create and maintain `latest-analysis.json` symlink
- Generate metadata files with extended information
- Include service health snapshot in metadata
- Add hash generation for unique identification

**Key Functions to Implement**:
```typescript
const generateFileName = (mode: string, timestamp: number): string => {
  const hash = crypto.createHash('md5')
    .update(`${timestamp}-${mode}-${Math.random()}`)
    .digest('hex')
    .substring(0, 6)

  return `analysis-${timestamp}-${mode}-${hash}.json`
}

const updateLatestSymlink = async (fileName: string): Promise<void> => {
  const symlinkPath = path.join(process.cwd(), 'public/analysis-results/latest-analysis.json')
  if (await fs.pathExists(symlinkPath)) {
    await fs.unlink(symlinkPath)
  }
  await fs.symlink(fileName, symlinkPath)
}
```

**Test Requirements**:
- File names follow convention
- Symlinks point to correct files
- Metadata files generated properly

---

### 2.4 Comprehensive Metadata Collection
**Todo**: Implement comprehensive metadata collection for analysis results
**Time Estimate**: 10 minutes
**Dependencies**: 2.3 Complete
**Files to Modify**:
- `/app/api/stocks/analysis-frontend/route.ts`
- `/app/services/file-output/AnalysisFileWriter.ts`

**Implementation Details**:
- Collect processing time metrics
- Record data sources used in analysis
- Capture service health status
- Include request parameters
- Add analysis configuration details

**Key Functions to Implement**:
```typescript
const collectAnalysisMetadata = (
  request: FrontendAnalysisRequest,
  result: AnalysisResult,
  startTime: number
): AnalysisMetadata => {
  return {
    analysisId: generateAnalysisId(),
    timestamp: Date.now(),
    requestId: generateRequestId(),
    mode: request.mode,
    processingTime: Date.now() - startTime,
    dataSourcesUsed: extractDataSources(result),
    serviceHealth: {
      totalServices: result.analysisInputServices ? Object.keys(result.analysisInputServices).length : 0,
      activeServices: countActiveServices(result.analysisInputServices),
      degradedServices: findDegradedServices(result.analysisInputServices)
    }
  }
}
```

**Test Requirements**:
- All metadata fields populated correctly
- Processing time accurate
- Service health properly assessed

---

## Phase 3: Frontend Integration (Estimated: 50 minutes)

### 3.1 Form Handler Implementation
**Todo**: Add handleAnalysis function to StockIntelligencePage component
**Time Estimate**: 15 minutes
**Dependencies**: 1.4, 2.4 Complete
**Files to Modify**:
- `/app/stock-intelligence/page.tsx`

**Implementation Details**:
- Add async handleAnalysis function to existing component
- Implement error state management
- Add loading state management
- Include success state handling
- Preserve existing form functionality

**Key Functions to Implement**:
```typescript
const handleAnalysis = async () => {
  setIsAnalyzing(true)
  setError(null)
  setAnalysisResult(null)

  try {
    const requestData = buildAnalysisRequest()
    const response = await fetch('/api/stocks/analysis-frontend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(requestData)
    })

    const result = await response.json()
    if (result.success) {
      setAnalysisResult(result.data)
      // Show success message or navigate to results
    } else {
      setError(result.error || 'Analysis failed')
    }
  } catch (error) {
    console.error('Analysis request failed:', error)
    setError('Analysis failed. Please check your connection and try again.')
  } finally {
    setIsAnalyzing(false)
  }
}
```

**Test Requirements**:
- Function handles all three analysis modes
- Loading states work correctly
- Error handling comprehensive

---

### 3.2 Request Builder Function
**Todo**: Implement buildAnalysisRequest function for form data transformation
**Time Estimate**: 12 minutes
**Dependencies**: 3.1 Complete
**Files to Modify**:
- `/app/stock-intelligence/page.tsx`

**Implementation Details**:
- Transform form state to API request format
- Handle sector selection logic
- Handle multiple symbol logic
- Add default options configuration
- Include input validation

**Key Functions to Implement**:
```typescript
const buildAnalysisRequest = (): FrontendAnalysisRequest => {
  // Validate we have either sector or symbols
  if (!selectedSector && selectedSymbols.length === 0) {
    throw new Error('Please select a sector or enter stock symbols')
  }

  if (selectedSector) {
    return {
      mode: 'sector',
      sector: {
        id: selectedSector.id,
        label: selectedSector.label,
        category: selectedSector.category
      },
      options: {
        useRealTimeData: true,
        includeSentiment: true,
        includeNews: true,
        timeout: 30000
      }
    }
  } else if (selectedSymbols.length > 1) {
    return {
      mode: 'multiple',
      symbols: selectedSymbols.map(s => s.toUpperCase().trim()),
      options: {
        useRealTimeData: true,
        includeSentiment: true,
        includeNews: true,
        timeout: 30000
      }
    }
  } else {
    return {
      mode: 'single',
      symbols: selectedSymbols.map(s => s.toUpperCase().trim()),
      options: {
        useRealTimeData: true,
        includeSentiment: true,
        includeNews: true,
        timeout: 30000
      }
    }
  }
}
```

**Test Requirements**:
- Correctly identifies mode based on form state
- Validates input before building request
- Formats symbols consistently

---

### 3.3 Loading State Implementation
**Todo**: Add loading states and progress indicators to analysis button
**Time Estimate**: 10 minutes
**Dependencies**: 3.2 Complete
**Files to Modify**:
- `/app/stock-intelligence/page.tsx`

**Implementation Details**:
- Update existing button with loading states
- Add loading spinner component
- Include progress text updates
- Disable form during analysis
- Add timeout handling with user feedback

**Key Functions to Implement**:
```typescript
// Button state during analysis
<button
  onClick={handleAnalysis}
  disabled={isAnalyzing || (!selectedSector && selectedSymbols.length === 0)}
  className={`cyber-button-primary ${isAnalyzing ? 'loading' : ''}`}
>
  {isAnalyzing ? (
    <div className="flex items-center gap-2">
      <LoadingSpinner />
      <span>Analyzing...</span>
      <span className="text-sm opacity-75">
        ({Math.floor((Date.now() - analysisStartTime) / 1000)}s)
      </span>
    </div>
  ) : (
    'Run Deep Analysis'
  )}
</button>
```

**Test Requirements**:
- Loading states display correctly
- Button properly disabled during analysis
- Timeout handling works

---

### 3.4 Error Display Component
**Todo**: Create ErrorDisplay component for user-friendly error messages
**Time Estimate**: 8 minutes
**Dependencies**: 3.1 Complete
**Files to Create**:
- `/app/components/analysis/ErrorDisplay.tsx`
- Files to Modify: `/app/stock-intelligence/page.tsx`

**Implementation Details**:
- Create reusable error display component
- Include retry functionality
- Add error categorization for different error types
- Implement user-friendly error messages
- Include dismiss functionality

**Key Functions to Implement**:
```typescript
interface ErrorDisplayProps {
  error: string
  onRetry: () => void
  onDismiss: () => void
  type?: 'validation' | 'api' | 'network' | 'timeout'
}

export const ErrorDisplay = ({ error, onRetry, onDismiss, type = 'api' }: ErrorDisplayProps) => {
  const getErrorIcon = () => {
    switch (type) {
      case 'validation': return '⚠️'
      case 'network': return '🔌'
      case 'timeout': return '⏱️'
      default: return '❌'
    }
  }

  const getErrorTitle = () => {
    switch (type) {
      case 'validation': return 'Input Error'
      case 'network': return 'Connection Error'
      case 'timeout': return 'Analysis Timeout'
      default: return 'Analysis Failed'
    }
  }

  return (
    <div className="error-container bg-red-900/20 border border-red-500 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{getErrorIcon()}</span>
        <div className="flex-1">
          <h4 className="text-red-400 font-semibold mb-1">{getErrorTitle()}</h4>
          <p className="text-red-300 mb-3">{error}</p>
          <div className="flex gap-2">
            <button
              onClick={onRetry}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
            >
              Try Again
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Test Requirements**:
- Component displays different error types correctly
- Retry functionality works
- Dismiss functionality clears error state

---

### 3.5 Success State Display
**Todo**: Add success state display with file path and metadata
**Time Estimate**: 5 minutes
**Dependencies**: 3.1 Complete
**Files to Modify**:
- `/app/stock-intelligence/page.tsx`

**Implementation Details**:
- Display analysis completion message
- Show file path and download link
- Display processing time and metadata
- Include link to view JSON results
- Add option to run another analysis

**Key Functions to Implement**:
```typescript
const SuccessDisplay = ({ result }: { result: FrontendAnalysisResponse['data'] }) => (
  <div className="success-container bg-green-900/20 border border-green-500 rounded-lg p-4">
    <div className="flex items-start gap-3">
      <span className="text-2xl">✅</span>
      <div className="flex-1">
        <h4 className="text-green-400 font-semibold mb-2">Analysis Complete!</h4>
        <div className="space-y-2 text-sm text-green-300">
          <p>Processing Time: {result.processingTime}ms</p>
          <p>Results: {result.resultsCount} stocks analyzed</p>
          <p>File: {result.filePath}</p>
        </div>
        <div className="flex gap-2 mt-3">
          <a
            href={`/analysis-results/${result.filePath}`}
            target="_blank"
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
          >
            View Results
          </a>
          <button
            onClick={() => setAnalysisResult(null)}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
          >
            Run Another Analysis
          </button>
        </div>
      </div>
    </div>
  </div>
)
```

**Test Requirements**:
- Success state displays after successful analysis
- Links to results files work
- Metadata displayed correctly

---

## Phase 4: Additional Features (Estimated: 25 minutes)

### 4.1 Health Check Endpoint
**Todo**: Add GET handler for health check functionality
**Time Estimate**: 5 minutes
**Dependencies**: 1.1 Complete
**Files to Modify**:
- `/app/api/stocks/analysis-frontend/route.ts`

**Implementation Details**:
- Implement simple GET handler for endpoint health
- Check StockSelectionService availability
- Verify file system write permissions
- Return service status information

**Key Functions to Implement**:
```typescript
export async function GET() {
  try {
    const stockSelection = new StockSelectionService()
    await stockSelection.initialize()

    // Check file system
    const testFile = path.join(process.cwd(), 'public/analysis-results/.health-check')
    await fs.writeFile(testFile, 'test')
    await fs.unlink(testFile)

    return NextResponse.json({
      status: 'healthy',
      timestamp: Date.now(),
      services: {
        stockSelection: 'available',
        fileSystem: 'writable'
      }
    })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message
    }, { status: 503 })
  }
}
```

**Test Requirements**:
- GET request returns health status
- Detects service availability issues
- File system checks work

---

### 4.2 Client-Side Validation
**Todo**: Implement client-side form validation
**Time Estimate**: 10 minutes
**Dependencies**: 3.2 Complete
**Files to Modify**:
- `/app/stock-intelligence/page.tsx`

**Implementation Details**:
- Add real-time symbol validation
- Check sector selection requirements
- Validate symbol format (letters, numbers, periods)
- Provide immediate feedback on form errors
- Prevent submission of invalid data

**Key Functions to Implement**:
```typescript
const validateFormData = (): ValidationErrors => {
  const errors: ValidationErrors = {}

  if (!selectedSector && selectedSymbols.length === 0) {
    errors.general = 'Please select a sector or enter at least one stock symbol'
  }

  if (selectedSymbols.length > 0) {
    const invalidSymbols = selectedSymbols.filter(symbol => {
      return !/^[A-Za-z0-9.]{1,8}$/.test(symbol.trim())
    })

    if (invalidSymbols.length > 0) {
      errors.symbols = `Invalid symbol format: ${invalidSymbols.join(', ')}`
    }
  }

  if (selectedSymbols.length > 10) {
    errors.symbols = 'Maximum 10 symbols allowed for analysis'
  }

  return errors
}

const isFormValid = (): boolean => {
  const errors = validateFormData()
  return Object.keys(errors).length === 0
}
```

**Test Requirements**:
- Invalid symbols rejected in real-time
- Form submission blocked when invalid
- Error messages clear and actionable

---

### 4.3 File Cleanup System
**Todo**: Implement automatic file cleanup system for analysis results
**Time Estimate**: 10 minutes
**Dependencies**: 2.2 Complete
**Files to Create**:
- `/app/services/file-output/FileCleanupService.ts`

**Implementation Details**:
- Delete files older than 7 days automatically
- Monitor disk space usage
- Clean up orphaned temporary files
- Maintain latest-analysis.json symlink
- Log cleanup activities

**Key Functions to Implement**:
```typescript
export class FileCleanupService {
  private readonly RETENTION_DAYS = 7
  private readonly MAX_FILES = 100

  async cleanupOldFiles(): Promise<void> {
    const resultsDir = path.join(process.cwd(), 'public/analysis-results')
    const cutoffTime = Date.now() - (this.RETENTION_DAYS * 24 * 60 * 60 * 1000)

    const files = await fs.readdir(resultsDir)
    const analysisFiles = files.filter(file => file.startsWith('analysis-') && file.endsWith('.json'))

    for (const file of analysisFiles) {
      const filePath = path.join(resultsDir, file)
      const stats = await fs.stat(filePath)

      if (stats.mtime.getTime() < cutoffTime) {
        await fs.unlink(filePath)
        console.log(`Cleaned up old analysis file: ${file}`)
      }
    }
  }

  async enforceFileLimit(): Promise<void> {
    const resultsDir = path.join(process.cwd(), 'public/analysis-results')
    const files = await fs.readdir(resultsDir)
    const analysisFiles = files
      .filter(file => file.startsWith('analysis-') && file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(resultsDir, file),
        mtime: fs.statSync(path.join(resultsDir, file)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

    if (analysisFiles.length > this.MAX_FILES) {
      const filesToDelete = analysisFiles.slice(this.MAX_FILES)
      for (const file of filesToDelete) {
        await fs.unlink(file.path)
        console.log(`Cleaned up excess analysis file: ${file.name}`)
      }
    }
  }
}
```

**Test Requirements**:
- Old files deleted automatically
- File limits enforced
- Cleanup doesn't break symlinks

---

## Phase 5: Testing and Validation (Estimated: 40 minutes)

### 5.1 Integration Tests
**Todo**: Create comprehensive integration tests for all three modes
**Time Estimate**: 20 minutes
**Dependencies**: All implementation phases complete
**Files to Create**:
- `/app/__tests__/api/analysis-frontend.integration.test.ts`

**Implementation Details**:
- Test single stock analysis end-to-end
- Test sector analysis with real data
- Test multiple stock analysis
- Verify JSON file generation and format
- Test error scenarios and fallbacks

**Key Tests to Implement**:
```typescript
describe('Analysis Frontend API Integration', () => {
  describe('Single Stock Mode', () => {
    it('should analyze single stock and generate JSON file', async () => {
      const response = await request(app)
        .post('/api/stocks/analysis-frontend')
        .send({
          mode: 'single',
          symbols: ['AAPL'],
          options: {
            useRealTimeData: true,
            includeSentiment: true,
            includeNews: true,
            timeout: 30000
          }
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.filePath).toBeDefined()

      // Verify file exists
      const filePath = path.join(process.cwd(), 'public/analysis-results', response.body.data.filePath)
      expect(await fs.pathExists(filePath)).toBe(true)

      // Verify file format
      const fileContent = await fs.readJson(filePath)
      expect(fileContent.metadata).toBeDefined()
      expect(fileContent.results).toBeDefined()
      expect(fileContent.results.topSelections).toBeArray()
    })
  })

  describe('Sector Analysis Mode', () => {
    it('should analyze sector and generate comprehensive results', async () => {
      const response = await request(app)
        .post('/api/stocks/analysis-frontend')
        .send({
          mode: 'sector',
          sector: {
            id: 'technology',
            label: 'Technology',
            category: 'sector'
          }
        })

      expect(response.status).toBe(200)
      expect(response.body.data.resultsCount).toBeGreaterThan(0)
    })
  })

  describe('Multiple Stocks Mode', () => {
    it('should analyze multiple stocks efficiently', async () => {
      const startTime = Date.now()

      const response = await request(app)
        .post('/api/stocks/analysis-frontend')
        .send({
          mode: 'multiple',
          symbols: ['AAPL', 'GOOGL', 'MSFT']
        })

      const processingTime = Date.now() - startTime

      expect(response.status).toBe(200)
      expect(processingTime).toBeLessThan(3000) // Sub-3-second requirement
      expect(response.body.data.resultsCount).toBe(3)
    })
  })
})
```

**Test Requirements**:
- All tests pass with real API data
- Performance requirements met
- File outputs verified

---

### 5.2 Performance Tests
**Todo**: Add performance tests to ensure sub-3-second analysis completion
**Time Estimate**: 10 minutes
**Dependencies**: 5.1 Complete
**Files to Modify**:
- `/app/__tests__/api/analysis-frontend.integration.test.ts`

**Implementation Details**:
- Measure end-to-end response times
- Test with various symbol combinations
- Verify memory usage patterns
- Test concurrent request handling

**Key Tests to Implement**:
```typescript
describe('Performance Requirements', () => {
  it('should complete single stock analysis under 3 seconds', async () => {
    const startTime = Date.now()

    const response = await request(app)
      .post('/api/stocks/analysis-frontend')
      .send({
        mode: 'single',
        symbols: ['AAPL']
      })

    const totalTime = Date.now() - startTime

    expect(response.status).toBe(200)
    expect(totalTime).toBeLessThan(3000)
    expect(response.body.data.processingTime).toBeLessThan(2800) // Allow buffer for HTTP overhead
  })

  it('should handle concurrent requests efficiently', async () => {
    const requests = Array.from({ length: 3 }, () =>
      request(app)
        .post('/api/stocks/analysis-frontend')
        .send({
          mode: 'single',
          symbols: ['TSLA']
        })
    )

    const startTime = Date.now()
    const responses = await Promise.all(requests)
    const totalTime = Date.now() - startTime

    responses.forEach(response => {
      expect(response.status).toBe(200)
    })

    // Should complete within reasonable time even with concurrency
    expect(totalTime).toBeLessThan(10000)
  })
})
```

**Test Requirements**:
- Performance benchmarks met
- Concurrent requests handled properly
- Memory usage within limits

---

### 5.3 Error Handling Tests
**Todo**: Create comprehensive error handling tests
**Time Estimate**: 10 minutes
**Dependencies**: 5.1 Complete
**Files to Modify**:
- `/app/__tests__/api/analysis-frontend.integration.test.ts`

**Implementation Details**:
- Test invalid request formats
- Test service unavailability scenarios
- Test rate limiting behavior
- Test file system errors
- Verify graceful degradation

**Key Tests to Implement**:
```typescript
describe('Error Handling', () => {
  it('should return 400 for invalid request format', async () => {
    const response = await request(app)
      .post('/api/stocks/analysis-frontend')
      .send({
        mode: 'invalid',
        symbols: []
      })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.error).toBeDefined()
  })

  it('should handle missing symbols gracefully', async () => {
    const response = await request(app)
      .post('/api/stocks/analysis-frontend')
      .send({
        mode: 'single'
        // Missing symbols array
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('symbols')
  })

  it('should validate symbol format', async () => {
    const response = await request(app)
      .post('/api/stocks/analysis-frontend')
      .send({
        mode: 'single',
        symbols: ['INVALID_SYMBOL_123!@#']
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('Invalid symbol')
  })
})
```

**Test Requirements**:
- All error scenarios covered
- Error messages user-friendly
- Security validation working

---

## Implementation Summary

### Total Estimated Time: 3.2 hours

**Phase Breakdown**:
- Phase 1 (API Endpoint): 45 minutes
- Phase 2 (File Output): 30 minutes
- Phase 3 (Frontend Integration): 50 minutes
- Phase 4 (Additional Features): 25 minutes
- Phase 5 (Testing): 40 minutes

### Key Dependencies
```
1.1 → 1.2 → 1.3 → 1.4 (API Endpoint Chain)
2.1 → 2.2 → 2.3 → 2.4 (File Output Chain)
1.4, 2.4 → 3.1 → 3.2 → 3.3, 3.4, 3.5 (Frontend Chain)
All Phases → 5.1 → 5.2, 5.3 (Testing Chain)
```

### Success Criteria Validation
- ✅ Form data reaches StockSelectionService
- ✅ Analysis results saved to structured JSON files
- ✅ Loading states and error handling implemented
- ✅ Sub-3-second analysis completion maintained
- ✅ Graceful degradation when APIs unavailable
- ✅ File output includes comprehensive metadata
- ✅ All three analysis modes supported

### Files Created/Modified Summary

**New Files**:
- `/app/api/stocks/analysis-frontend/route.ts`
- `/app/services/file-output/AnalysisFileWriter.ts`
- `/app/services/file-output/FileCleanupService.ts`
- `/app/components/analysis/ErrorDisplay.tsx`
- `/app/__tests__/api/analysis-frontend.integration.test.ts`
- `public/analysis-results/` (directory structure)

**Modified Files**:
- `/app/stock-intelligence/page.tsx`

This implementation plan maintains all existing VFR architecture patterns while adding the requested frontend-backend integration with comprehensive error handling and file output capabilities.