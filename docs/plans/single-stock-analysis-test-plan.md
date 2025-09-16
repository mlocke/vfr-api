# Single Stock Analysis Test Plan

## Overview
This document outlines the testing strategy for validating the stock selection engine's ability to analyze a single stock (AAPL) from frontend request to backend response.

## Issue Resolution Status
- ✅ **URL Mismatch Fixed**: Frontend now calls correct endpoint `/api/stocks/select`
- ✅ **Cache Interface Fixed**: Added missing `universe` method to `AlgorithmCacheKeys`
- 🔄 **Ready for Testing**: System should now handle basic single stock analysis

## Test Scenarios

### 1. Basic Single Stock Request
**Endpoint**: `POST /api/stocks/select`
**Payload**:
```json
{
  "scope": {
    "mode": "single_stock",
    "symbols": ["AAPL"]
  }
}
```

**Expected Response Structure**:
```json
{
  "success": true,
  "requestId": "req_...",
  "timestamp": 1234567890,
  "executionTime": 1500,
  "topSelections": [
    {
      "symbol": "AAPL",
      "score": {...},
      "weight": 1.0,
      "action": "BUY",
      "confidence": 0.85
    }
  ],
  "metadata": {
    "algorithmUsed": "composite",
    "dataSourcesUsed": ["polygon", "alpha_vantage"],
    "analysisMode": "single_stock"
  }
}
```

### 2. Frontend Integration Test
**Location**: Market Intelligence Page (`/stock-intelligence`)
**Steps**:
1. Navigate to Market Intelligence page
2. Select "Single Stock" mode
3. Enter "AAPL" symbol
4. Click "Analyze" button
5. Verify loading state displays
6. Confirm results display properly

### 3. Error Handling Tests
**Invalid Symbol**:
```json
{
  "scope": {
    "mode": "single_stock",
    "symbols": ["INVALID"]
  }
}
```

**Empty Request**:
```json
{
  "scope": {
    "mode": "single_stock",
    "symbols": []
  }
}
```

**Multiple Symbols (should fail)**:
```json
{
  "scope": {
    "mode": "single_stock",
    "symbols": ["AAPL", "MSFT"]
  }
}
```

## Testing Commands

### Direct API Test
```bash
curl -X POST http://localhost:3000/api/stocks/select \
  -H "Content-Type: application/json" \
  -d '{"scope": {"mode": "single_stock", "symbols": ["AAPL"]}}' \
  -v
```

### Browser Console Test
```javascript
fetch('/api/stocks/select', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scope: {
      mode: 'single_stock',
      symbols: ['AAPL']
    }
  })
})
.then(res => res.json())
.then(console.log)
.catch(console.error);
```

## Expected Behaviors

### Success Case
- Response time: < 30 seconds
- Valid JSON response with `success: true`
- Single stock result in `topSelections`
- Proper metadata including algorithm used
- Frontend displays analysis results

### Error Cases
- Invalid requests return `400` status
- Error messages are descriptive
- Frontend shows user-friendly error display
- Proper error logging in console

## Validation Checklist

### Backend Validation
- [ ] Request validation passes for valid AAPL request
- [ ] Algorithm engine executes without cache errors
- [ ] Data fusion completes successfully
- [ ] Response includes all required fields
- [ ] Performance metrics are within acceptable range

### Frontend Validation
- [ ] Loading state displays during analysis
- [ ] Results render correctly in UI
- [ ] Error states display user-friendly messages
- [ ] Real-time updates work (if enabled)
- [ ] Cancel functionality works

### Integration Validation
- [ ] End-to-end flow completes successfully
- [ ] No console errors in browser
- [ ] Proper request/response logging
- [ ] Cache hit/miss rates are reasonable
- [ ] Memory usage remains stable

## Success Criteria

1. **Functional**: AAPL analysis completes successfully from frontend button click
2. **Performance**: Response time under 30 seconds for single stock
3. **User Experience**: Clear feedback during loading and on completion
4. **Error Handling**: Graceful degradation for invalid inputs
5. **Monitoring**: Proper logging and error tracking

## Next Steps After Testing

1. **Expand Symbol Coverage**: Test with different stock symbols
2. **Multiple Stock Mode**: Validate multi-stock analysis
3. **Sector Analysis**: Test sector-based selection
4. **Real Data Integration**: Connect to live market data sources
5. **Performance Optimization**: Optimize based on testing results

## Known Limitations

- Mock data may be used if external APIs are not configured
- Cache implementation may not be fully connected to Redis
- Factor calculations may use placeholder algorithms
- Data fusion may not have real multi-source integration

## Debugging Tools

- Browser Developer Tools Network tab
- Backend console logs
- API endpoint health check: `GET /api/stocks/select`
- Error boundary logs in React components