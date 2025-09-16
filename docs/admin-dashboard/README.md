# MCP/API Server Admin Dashboard

## Context & Purpose

**Problem Solved**: Centralized monitoring, testing, and management of 12 MCP (Model Context Protocol) data servers providing financial, economic, and intelligence data to the stock selection engine.

**Business Context**: The admin dashboard ensures data reliability through real-time status monitoring and comprehensive testing capabilities, reducing system downtime and improving data quality metrics.

**Technical Constraints**:
- Real-time updates every 3 seconds
- Maximum 30-second timeout for complex tests
- Glassmorphism UI consistency with existing platform
- Responsive design supporting mobile/desktop views

**Success Criteria**:
- 75%+ server availability monitoring
- <5s response time for test execution
- Real-time status updates without page refresh
- Comprehensive test coverage across all server types

## Architecture Overview

### Component Hierarchy
```
app/admin/page.tsx (Main Dashboard)
├── AdminStatusMonitor.tsx (Real-time monitoring widget)
├── API: /api/admin/test-servers/route.ts (Test execution)
├── useAdminDashboard.ts (State management hook)
└── Homepage integration (app/page.tsx)
```

### Data Flow Architecture
```
User Interface → Test Configuration → API Endpoint → MCP Client → Server Response
     ↓              ↓                    ↓              ↓            ↓
Status Monitor ← State Updates ← Result Processing ← Test Execution ← Server Testing
```

### Server Categories
- **Financial (5 servers)**: Polygon.io, Alpha Vantage, FMP, Yahoo Finance, SEC EDGAR
- **Economic (5 servers)**: Treasury, Data.gov, FRED, BLS, EIA
- **Intelligence (2 servers)**: Firecrawl, Dappier

## Implementation Details

### Core Components

#### Main Dashboard (`app/admin/page.tsx`)
**Purpose**: Three-column admin interface with server selection, test controls, and results display.

**Key Features**:
- Checkbox-based server selection with category filtering
- Test type configuration (connection/data/performance/comprehensive)
- Real-time test execution with progress tracking
- Tabbed results display (results/raw/performance)

**State Management**:
```typescript
interface TestConfig {
  selectedServers: string[]
  testType: 'connection' | 'data' | 'performance' | 'comprehensive'
  timeout: number
  maxRetries: number
  parallelRequests: boolean
}
```

#### API Endpoint (`app/api/admin/test-servers/route.ts`)
**Purpose**: Server-side test execution with real MCP client integration.

**Request Format**:
```typescript
POST /api/admin/test-servers
{
  serverIds: string[]
  testType: 'connection' | 'data' | 'performance' | 'comprehensive'
  timeout?: number
  maxRetries?: number
  parallelRequests?: boolean
}
```

**Response Format**:
```typescript
{
  success: boolean
  testType: string
  results: TestResult[]
  summary: {
    total: number
    success: number
    failed: number
    avgResponseTime: number
    successRate: number
    timestamp: number
  }
}
```

#### Status Monitor (`app/components/AdminStatusMonitor.tsx`)
**Purpose**: Real-time server health monitoring with visual status indicators.

**Update Mechanism**:
- 3-second automatic refresh intervals
- Status simulation with realistic failure rates
- Visual status indicators (🟢🟡🔴)
- Aggregate statistics display

#### State Management Hook (`app/hooks/useAdminDashboard.ts`)
**Purpose**: Centralized state management for dashboard operations.

**Capabilities**:
- Server status initialization and updates
- Real-time monitoring control (start/stop)
- Test execution coordination
- Global status calculation (healthy/degraded/critical)

### Server Configuration Structure

```typescript
interface ServerConfig {
  id: string
  name: string
  category: 'financial' | 'economic' | 'intelligence'
  description: string
  status: 'online' | 'offline' | 'degraded'
  rateLimit: number
  timeout: number
}
```

**Server Definitions**:
```typescript
const serverConfigs = [
  // Financial Data Servers
  { id: 'polygon', name: 'Polygon.io MCP', rateLimit: 1000, timeout: 5000 },
  { id: 'alphavantage', name: 'Alpha Vantage MCP', rateLimit: 500, timeout: 10000 },
  { id: 'fmp', name: 'Financial Modeling Prep', rateLimit: 300, timeout: 8000 },
  { id: 'yahoo', name: 'Yahoo Finance MCP', rateLimit: 2000, timeout: 3000 },
  { id: 'sec_edgar', name: 'SEC EDGAR MCP', rateLimit: 100, timeout: 15000 },

  // Economic Data Servers
  { id: 'treasury', name: 'Treasury MCP', rateLimit: 200, timeout: 8000 },
  { id: 'datagov', name: 'Data.gov MCP', rateLimit: 150, timeout: 12000 },
  { id: 'fred', name: 'FRED MCP', rateLimit: 120, timeout: 10000 },
  { id: 'bls', name: 'BLS MCP', rateLimit: 100, timeout: 15000 },
  { id: 'eia', name: 'EIA MCP', rateLimit: 200, timeout: 8000 },

  // Intelligence Servers
  { id: 'firecrawl', name: 'Firecrawl MCP', rateLimit: 300, timeout: 20000 },
  { id: 'dappier', name: 'Dappier MCP', rateLimit: 500, timeout: 10000 }
]
```

## Usage Guide

### Administrator Workflow

#### 1. Access Dashboard
Navigate to `/admin` or use the admin button on homepage (top-right, below Market Intelligence button).

#### 2. Monitor Server Status
- **Start Monitoring**: Click "▶️ Start Monitoring" to begin real-time updates
- **View Summary**: Monitor aggregate statistics (online/degraded/offline counts)
- **Individual Status**: Check individual server response times and health

#### 3. Configure Tests
**Server Selection**:
- Individual checkbox selection
- Category-based selection (📈 Financial, 📊 Economic, 🧠 Intelligence)
- Select All / Deselect All options

**Test Configuration**:
- **Connection Test**: Basic connectivity verification
- **Data Retrieval Test**: Sample data fetching validation
- **Performance Test**: Multi-request throughput analysis
- **Comprehensive Test**: Combined connection and data validation

**Advanced Options**:
- Timeout configuration (default: 10,000ms)
- Max retries (default: 3)
- Parallel vs sequential execution

#### 4. Execute Tests
1. Select target servers using checkboxes
2. Configure test type and parameters
3. Click "🚀 Run Tests" button
4. Monitor progress bar and real-time results
5. Review results in tabbed interface (Results/Raw/Performance)

#### 5. Interpret Results
**Success Indicators**:
- ✅ Green border: Successful test execution
- Response time display
- Data quality percentage
- Cache status indication

**Failure Indicators**:
- ❌ Red border: Failed test execution
- Error message display
- No response time data

### Decision Trees

#### Server Health Assessment
```
Server Status Check
├── Online (🟢)
│   ├── Response time < 1000ms → Healthy
│   └── Response time > 1000ms → Monitor closely
├── Degraded (🟡)
│   ├── Intermittent connectivity → Schedule maintenance
│   └── High response times → Investigate performance
└── Offline (🔴)
    ├── Recent failure → Retry test
    └── Persistent failure → Escalate to infrastructure team
```

#### Test Type Selection
```
Test Requirement
├── Quick connectivity check → Connection Test
├── Data quality validation → Data Retrieval Test
├── Performance benchmarking → Performance Test
└── Full system validation → Comprehensive Test
```

## API Endpoints

### POST /api/admin/test-servers

**Purpose**: Execute tests against selected MCP servers with configurable parameters.

**Authentication**: None required (internal admin tool)

**Rate Limits**: None enforced

**Request Schema**:
```typescript
{
  serverIds: string[]           // Required: Array of server IDs to test
  testType: TestType           // Required: Type of test to execute
  timeout?: number             // Optional: Test timeout in milliseconds
  maxRetries?: number          // Optional: Maximum retry attempts
  parallelRequests?: boolean   // Optional: Execute tests in parallel
}

type TestType = 'connection' | 'data' | 'performance' | 'comprehensive'
```

**Response Schema**:
```typescript
{
  success: boolean
  testType: string
  results: TestResult[]
  summary: TestSummary
}

interface TestResult {
  serverId: string
  serverName: string
  success: boolean
  responseTime: number
  error?: string
  data?: any
  metadata?: {
    cached: boolean
    dataQuality: number
    timestamp: number
  }
}

interface TestSummary {
  total: number
  success: number
  failed: number
  avgResponseTime: number
  successRate: number
  timestamp: number
}
```

**Error Responses**:
- `400 Bad Request`: Invalid server IDs or missing required parameters
- `500 Internal Server Error`: Test execution failure or server error

**Example Usage**:
```typescript
// Test all financial servers with comprehensive validation
const response = await fetch('/api/admin/test-servers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serverIds: ['polygon', 'alphavantage', 'fmp', 'yahoo', 'sec_edgar'],
    testType: 'comprehensive',
    timeout: 15000,
    maxRetries: 3,
    parallelRequests: true
  })
})
```

## Testing Procedures

### Unit Testing

#### Component Testing
```typescript
// Test AdminStatusMonitor component
describe('AdminStatusMonitor', () => {
  test('displays correct server count', () => {
    render(<AdminStatusMonitor servers={mockServers} />)
    expect(screen.getByText('12 servers')).toBeInTheDocument()
  })

  test('updates status every 3 seconds when monitoring', () => {
    const { rerender } = render(<AdminStatusMonitor servers={mockServers} />)
    // Advance timer and verify updates
  })
})
```

#### API Endpoint Testing
```typescript
// Test /api/admin/test-servers endpoint
describe('/api/admin/test-servers', () => {
  test('validates server IDs', async () => {
    const response = await request(app)
      .post('/api/admin/test-servers')
      .send({ serverIds: ['invalid'], testType: 'connection' })
    expect(response.status).toBe(400)
  })

  test('executes connection tests successfully', async () => {
    const response = await request(app)
      .post('/api/admin/test-servers')
      .send({ serverIds: ['yahoo'], testType: 'connection' })
    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
  })
})
```

### Integration Testing

#### End-to-End Dashboard Testing
```typescript
describe('Admin Dashboard E2E', () => {
  test('complete test workflow', async () => {
    // 1. Navigate to admin dashboard
    await page.goto('/admin')

    // 2. Select servers
    await page.click('[data-testid="select-financial"]')

    // 3. Configure test
    await page.selectOption('[data-testid="test-type"]', 'connection')

    // 4. Execute test
    await page.click('[data-testid="run-tests"]')

    // 5. Verify results
    await expect(page.locator('[data-testid="test-results"]')).toBeVisible()
  })
})
```

### Performance Testing

#### Load Testing Configuration
```bash
# Test API endpoint with multiple concurrent requests
artillery quick --count 10 --num 5 http://localhost:3000/api/admin/test-servers
```

#### Response Time Benchmarks
- Connection tests: <2 seconds
- Data retrieval tests: <5 seconds
- Performance tests: <10 seconds
- Comprehensive tests: <15 seconds

## Troubleshooting

### Common Issues

#### Test Execution Failures
**Problem**: Tests fail with timeout errors
**Cause**: Network latency or server overload
**Solution**:
1. Increase timeout configuration
2. Reduce parallel request count
3. Check server status indicators
4. Retry with sequential execution

**Problem**: API returns 500 errors
**Cause**: MCP client initialization failure
**Solution**:
1. Verify MCP client configuration
2. Check server logs for detailed error messages
3. Restart application if necessary

#### Status Monitor Issues
**Problem**: Status monitor shows all servers offline
**Cause**: Monitoring service not started or connection issues
**Solution**:
1. Click "Start Monitoring" button
2. Check network connectivity
3. Refresh page and retry

**Problem**: Status updates stop working
**Cause**: JavaScript interval cleared or component unmounted
**Solution**:
1. Stop and restart monitoring
2. Refresh page
3. Check browser console for errors

#### UI/UX Issues
**Problem**: Dashboard not responsive on mobile
**Cause**: CSS grid breakpoints not applied correctly
**Solution**:
1. Verify responsive CSS classes
2. Check viewport meta tag
3. Test on multiple screen sizes

**Problem**: Test results not displaying
**Cause**: State management issue or API response parsing error
**Solution**:
1. Check browser developer tools
2. Verify API response format
3. Clear component state and retry

### Diagnostic Commands

#### Server Status Check
```bash
# Check application logs
tail -f logs/admin-dashboard.log

# Verify MCP client status
curl -X GET http://localhost:3000/api/health/mcp-status
```

#### Performance Monitoring
```bash
# Monitor API response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/admin/test-servers

# Check memory usage
ps aux | grep node
```

### Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| 400 | Invalid server IDs | Verify server ID format and availability |
| 500 | Internal server error | Check server logs and MCP client status |
| TIMEOUT | Request timeout | Increase timeout or check server connectivity |
| RATE_LIMIT | Rate limit exceeded | Reduce request frequency or implement backoff |

## Operational Procedures

### Daily Monitoring Checklist
1. ✅ Check overall system status (green/yellow/red indicator)
2. ✅ Verify all 12 servers show "online" status
3. ✅ Run quick connection test on critical servers (yahoo, polygon)
4. ✅ Review response time trends for performance degradation
5. ✅ Check error logs for any failed requests

### Weekly Maintenance Tasks
1. 🔧 Execute comprehensive tests on all servers
2. 📊 Review performance metrics and trends
3. 🔄 Update server configurations if needed
4. 📝 Document any issues or improvements
5. 🧪 Test backup/failover procedures

### Emergency Response Procedures

#### Critical Server Failure (>3 servers offline)
1. **Immediate**: Switch to emergency mode
2. **Assessment**: Run comprehensive tests to identify scope
3. **Communication**: Alert development team
4. **Mitigation**: Activate backup data sources if available
5. **Resolution**: Follow incident response playbook

#### Performance Degradation (response times >5s)
1. **Monitor**: Increase monitoring frequency to 1-second intervals
2. **Analyze**: Review individual server performance metrics
3. **Optimize**: Reduce parallel request counts
4. **Scale**: Consider load balancing or server upgrades
5. **Document**: Record performance patterns for future optimization

This documentation provides comprehensive coverage of the MCP/API Server Admin Dashboard, enabling effective monitoring, testing, and maintenance of the critical data infrastructure supporting the stock selection platform.