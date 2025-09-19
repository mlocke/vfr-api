# VFR API Integration Guide for AI Agents

## CONTEXT & PURPOSE

**Problem Being Solved**: Standardize integration of financial data APIs into the VFR platform while maintaining high availability through intelligent fallback mechanisms.

**Technical Constraints**:
- Rate limits vary by provider (5/min to 500/day)
- Government APIs have 8-15s response times
- Commercial APIs require paid keys
- No mock data allowed (company policy)

**Success Criteria**:
- New provider integration in <30 minutes
- Zero-downtime provider addition/removal
- Graceful degradation on provider failures
- Consistent data format across all sources

**Dependencies**: Next.js 15, TypeScript, environment variables for API keys

## IMPLEMENTATION ARCHITECTURE

### Core File Structure
```
app/services/financial-data/
├── FinancialDataService.ts      # Main orchestrator (CRITICAL)
├── types.ts                     # Unified interfaces (IMMUTABLE)
├── index.ts                     # Export registry (UPDATE REQUIRED)
├── [Provider]API.ts             # Individual implementations
└── app/services/admin/DataSourceConfigManager.ts  # Configuration
```

### Data Flow Architecture
```
Client Request → FinancialDataService → Provider Selection → API Call → Data Transformation → Cache → Response
                     ↓ (if provider fails)
                 Next Available Provider → [repeat process]
```

### Required Interface Implementation
```typescript
// CRITICAL: All providers MUST implement this interface
interface FinancialDataProvider {
  name: string
  getStockPrice(symbol: string): Promise<StockData | null>
  getCompanyInfo(symbol: string): Promise<CompanyInfo | null>
  getMarketData(symbol: string): Promise<MarketData | null>
  healthCheck(): Promise<boolean>
}

// CRITICAL: Return format for stock data
interface StockData {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: number  // Unix timestamp
  source: string     // Provider identifier
}
```

## STEP-BY-STEP INTEGRATION WORKFLOW

### Phase 1: Create Provider Class (5 minutes)

**File**: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/app/services/financial-data/[ProviderName]API.ts`

```typescript
import { FinancialDataProvider, StockData, CompanyInfo, MarketData, ApiResponse } from './types'

export class ProviderNameAPI implements FinancialDataProvider {
  name = 'Provider Name API'
  private apiKey: string
  private timeout: number
  private throwErrors: boolean
  private baseUrl: string

  constructor(apiKey?: string, timeout = 10000, throwErrors = false) {
    this.apiKey = apiKey || process.env.PROVIDER_API_KEY || ''
    this.timeout = timeout
    this.throwErrors = throwErrors
    this.baseUrl = 'https://api.provider.com/v1'
  }

  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      const response = await this.makeRequest('/quote', { symbol })

      if (!response.success || !response.data) {
        return null
      }

      // CRITICAL: Transform provider data to StockData interface
      return {
        symbol: symbol.toUpperCase(),
        price: Number(response.data.price),
        change: Number(response.data.change || 0),
        changePercent: Number(response.data.changePercent || 0),
        volume: Number(response.data.volume || 0),
        timestamp: Date.now(),
        source: 'provider-name'
      }
    } catch (error) {
      console.error(`ProviderNameAPI getStockPrice error:`, error)
      if (this.throwErrors) throw error
      return null
    }
  }

  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    // Similar pattern to getStockPrice
    return null // Implement if provider supports
  }

  async getMarketData(symbol: string): Promise<MarketData | null> {
    // Similar pattern to getStockPrice
    return null // Implement if provider supports
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/health', {})
      return response.success
    } catch {
      return false
    }
  }

  private async makeRequest(endpoint: string, params: any): Promise<ApiResponse<any>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const url = new URL(this.baseUrl + endpoint)
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined) {
          url.searchParams.append(key, params[key])
        }
      })

      // Add API key based on provider requirements
      url.searchParams.append('apikey', this.apiKey)

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VFR-Platform/1.0'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const data = await response.json()
      return { success: true, data }

    } catch (error: any) {
      clearTimeout(timeoutId)
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout' : error.message
      }
    }
  }
}
```

### Phase 2: Register in Configuration (2 minutes)

**File**: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/app/services/admin/DataSourceConfigManager.ts`

**Action**: Add provider to `PREDEFINED_DATA_SOURCES` array:

```typescript
{
  id: 'provider-name',
  name: 'Provider Name API',
  type: 'commercial', // or 'government' or 'free'
  status: 'online',
  enabled: true,
  hasApiKey: !!process.env.PROVIDER_API_KEY,
  rateLimit: 300, // requests per hour
  timeout: 10000, // milliseconds
  features: ['stock-price', 'company-info'], // supported features
  description: 'Brief description of data provided',
  documentation: 'https://docs.provider.com'
}
```

### Phase 3: Register in Service (3 minutes)

**File**: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/app/services/financial-data/FinancialDataService.ts`

**Action**: Add provider to constructor:

```typescript
// In constructor after existing providers
this.providers.push(new ProviderNameAPI())
```

### Phase 4: Update Exports (1 minute)

**File**: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/app/services/financial-data/index.ts`

**Action**: Add export:

```typescript
export { ProviderNameAPI } from './ProviderNameAPI'
```

### Phase 5: Environment Configuration (2 minutes)

**File**: `.env.local` or production environment

**Action**: Add API key:

```bash
PROVIDER_API_KEY=your_api_key_here
```

### Phase 6: Test Integration (5 minutes)

**Admin Route**: `/api/admin/test-data-sources`

**Test Payload**:
```json
{
  "dataSourceIds": ["provider-name"],
  "testType": "comprehensive",
  "timeout": 15000
}
```

## DECISION TREES FOR IMPLEMENTATION

### Provider Type Selection
```
Government API? → Use 15s timeout, no API key validation
Commercial API? → Use 10s timeout, validate API key format
Free API? → Use 5s timeout, implement rate limiting
```

### Error Handling Strategy
```
Network Error? → Return null, log error
Rate Limited? → Return null, log rate limit hit
Invalid Data? → Return null, log data validation error
Timeout? → Return null, log timeout
Authentication Error? → Return null, log auth failure
```

### Cache Strategy Selection
```
Stock Price Data? → Cache 5 minutes
Company Info? → Cache 24 hours
Market Data? → Cache 1 hour
Health Status? → Cache 30 seconds
```

## CRITICAL INTEGRATION POINTS

### Required Interface Compliance
- **MUST** implement all four methods from `FinancialDataProvider`
- **MUST** return null on errors (never throw unless `throwErrors=true`)
- **MUST** normalize symbols to uppercase
- **MUST** use Unix timestamps for all time data
- **MUST** include source identifier in response

### Service Registration Points
1. **FinancialDataService.ts**: Add to providers array
2. **DataSourceConfigManager.ts**: Add to predefined sources
3. **index.ts**: Export class for external use
4. **Environment**: Configure API keys and settings

### Admin Integration Points
- **Health Check**: Accessible via admin dashboard
- **Configuration**: Enable/disable via admin panel
- **Testing**: Test individual providers via admin API
- **Monitoring**: Real-time status in admin dashboard

## ERROR SCENARIOS & RESOLUTIONS

### Common Failure Modes

**API Key Invalid/Missing**
- **Detection**: HTTP 401/403 responses
- **Resolution**: Check environment variables, validate key format
- **Code Response**: Return null, log authentication error

**Rate Limit Exceeded**
- **Detection**: HTTP 429 or provider-specific error codes
- **Resolution**: Implement exponential backoff, switch to alternate provider
- **Code Response**: Return null, log rate limit hit

**Network Timeout**
- **Detection**: AbortError or network timeout
- **Resolution**: Verify timeout settings, check provider status
- **Code Response**: Return null, log timeout error

**Invalid Response Format**
- **Detection**: JSON parsing errors, missing required fields
- **Resolution**: Validate provider API documentation, update transformation logic
- **Code Response**: Return null, log data format error

**Provider Service Outage**
- **Detection**: Consistent failures across all requests
- **Resolution**: Fallback to alternate providers, monitor provider status
- **Code Response**: Health check returns false, automatic fallback

## WORKING CODE TEMPLATES

### Government API Template (BLS/FRED/EIA Pattern)
```typescript
export class GovernmentAPI implements FinancialDataProvider {
  name = 'Government Data API'
  private timeout = 15000 // Government APIs are slower

  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      // Government APIs often don't have traditional stock data
      // Adapt economic indicators to stock-like format
      const response = await this.makeRequest(`/series/${symbol}`)

      if (!response.success) return null

      const latestValue = response.data.observations[0]
      return {
        symbol: symbol.toUpperCase(),
        price: Number(latestValue.value),
        change: 0, // Calculate if historical data available
        changePercent: 0,
        volume: 0, // Not applicable to economic data
        timestamp: new Date(latestValue.date).getTime(),
        source: 'government-api'
      }
    } catch (error) {
      console.error('GovernmentAPI error:', error)
      return null
    }
  }
}
```

### Commercial API Template (Polygon/Alpha Vantage Pattern)
```typescript
export class CommercialAPI implements FinancialDataProvider {
  name = 'Commercial Data API'
  private timeout = 5000 // Commercial APIs are faster
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.COMMERCIAL_API_KEY || ''
    if (!this.apiKey) {
      console.warn('CommercialAPI: No API key provided')
    }
  }

  async getStockPrice(symbol: string): Promise<StockData | null> {
    if (!this.apiKey) return null

    try {
      const response = await this.makeRequest('/stocks/quote', {
        symbol,
        apikey: this.apiKey
      })

      if (!response.success) return null

      return {
        symbol: symbol.toUpperCase(),
        price: response.data.c, // Close price
        change: response.data.d, // Daily change
        changePercent: response.data.dp, // Daily change percent
        volume: response.data.v, // Volume
        timestamp: response.data.t * 1000, // Convert to milliseconds
        source: 'commercial-api'
      }
    } catch (error) {
      console.error('CommercialAPI error:', error)
      return null
    }
  }
}
```

## PERFORMANCE OPTIMIZATION PATTERNS

### Concurrent Request Pattern
```typescript
async getAllProviderData(symbol: string): Promise<StockData[]> {
  const promises = this.providers.map(provider =>
    provider.getStockPrice(symbol).catch(() => null)
  )

  const results = await Promise.allSettled(promises)
  return results
    .filter(result => result.status === 'fulfilled' && result.value)
    .map(result => (result as PromiseFulfilledResult<StockData>).value)
}
```

### Cache-First Pattern
```typescript
async getStockPriceWithCache(symbol: string): Promise<StockData | null> {
  const cacheKey = `stock_${symbol.toUpperCase()}`
  const cached = this.cache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
    return cached.data
  }

  const data = await this.getStockPrice(symbol)
  if (data) {
    this.cache.set(cacheKey, { data, timestamp: Date.now() })
  }

  return data
}
```

## QUALITY ASSURANCE CHECKLIST

### Pre-Integration Validation
- [ ] Provider class implements all required interface methods
- [ ] Environment variables configured and validated
- [ ] Error handling returns null instead of throwing
- [ ] Data transformation matches StockData interface
- [ ] Health check endpoint identified and tested
- [ ] Rate limits documented and respected
- [ ] Timeout values appropriate for provider type

### Post-Integration Validation
- [ ] Provider appears in admin dashboard
- [ ] Health check reports correctly
- [ ] Test API returns valid data
- [ ] Fallback mechanism works when provider disabled
- [ ] Cache invalidation functions properly
- [ ] Error scenarios handled gracefully
- [ ] Performance metrics within acceptable ranges

### Production Readiness
- [ ] API keys secured in environment variables
- [ ] Logging configured for debugging
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Provider status can be toggled via admin
- [ ] Rate limiting prevents API quota exhaustion
- [ ] Graceful degradation tested

## OPERATIONAL PROCEDURES

### Adding New Provider (Complete Process)
1. **Create Provider Class**: Follow template above
2. **Configure Environment**: Add API keys
3. **Register in Services**: Update all registration points
4. **Test Integration**: Use admin API for comprehensive testing
5. **Monitor Performance**: Verify metrics in admin dashboard
6. **Document Provider**: Update provider-specific documentation

### Troubleshooting Failed Integration
1. **Check Health Status**: Use admin dashboard health check
2. **Verify API Key**: Test authentication independently
3. **Review Logs**: Check console for specific error messages
4. **Test Network**: Verify provider endpoint accessibility
5. **Validate Data Format**: Ensure response matches expected schema
6. **Check Rate Limits**: Verify quota availability

### Provider Maintenance
1. **Monitor Health**: Regular health checks via admin panel
2. **Update API Keys**: Rotate keys as required by provider
3. **Adjust Rate Limits**: Modify based on usage patterns
4. **Update Timeouts**: Adjust based on performance metrics
5. **Review Documentation**: Keep provider docs current

## SYSTEM INTEGRATION POINTS

### File Dependencies
```
FinancialDataService.ts ← [Provider]API.ts
DataSourceConfigManager.ts ← Configuration metadata
index.ts ← Export registration
Admin API routes ← Testing endpoints
Environment variables ← API keys and settings
```

### Runtime Dependencies
- Environment variables for API keys
- Network connectivity to provider endpoints
- Memory cache for performance optimization
- Admin authentication for configuration access

### External Integration Points
- **Admin Dashboard**: Real-time provider status
- **Client Applications**: Data consumption endpoints
- **Monitoring Systems**: Health and performance metrics
- **Cache Layer**: Redis integration for scale

This documentation provides the complete foundation for integrating any financial data provider into the VFR platform. Follow the step-by-step workflow for consistent, reliable integrations that maintain system performance and reliability standards.