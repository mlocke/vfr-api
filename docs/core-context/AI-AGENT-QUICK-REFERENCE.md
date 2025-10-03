# VFR AI Agent Quick Reference Guide

**Created**: 2025-09-28
**Ultra-Condensed Decision Reference for Immediate AI Agent Actions**

## 🚨 EMERGENCY COMMAND MATRIX (< 30 seconds)

```
SYMPTOM                           → IMMEDIATE_COMMAND                    → SUCCESS_CHECK
Port conflict (EADDRINUSE)        → npm run dev:clean                   → Server starts port 3000
Memory errors (heap)              → export NODE_OPTIONS="--max-old-space-size=8192" → Tests complete
TypeScript errors                 → npm run type-check                  → 0 errors reported
API failures (429/500)            → Check /admin dashboard              → Fallbacks active
Redis down                        → Automatic in-memory fallback        → Cache still works
Test failures                     → npm test -- --verbose               → All tests pass
Performance issues                → npm run test:performance:memory     → Memory < 4GB
Build failures                    → npm run build                       → Clean build output
```

## ⚡ INSTANT VALIDATION SEQUENCE

**BEFORE ANY TASK** (30-second validation):

1. `curl localhost:3000/api/health` → Must return 200 OK
2. `npm run type-check` → Must show 0 errors
3. Check `/admin` → APIs green/yellow acceptable

## 🎯 DECISION TREES (AI-Optimized)

### Task Classification → Action Path

```
DEVELOPMENT_TASK
├── Code_Changes → type-check FIRST → Implement → Test
├── New_Feature → Real_APIs_Only → TDD_Approach → Integration
├── Bug_Fix → Health_Check → Admin_Dashboard → Debug
└── Performance → Memory_Check → Optimize → Validate

TESTING_TASK
├── Integration → Real_APIs → 5min_Timeout → Memory_Optimized
├── Performance → Memory_Pressure → GC_Explicit → Benchmark
├── Security → OWASP_Validation → Input_Sanitization → Compliance
└── Coverage → Service_Layer → 85%_Target → Report

ANALYSIS_TASK
├── Stock_Analysis → Multi_Modal → Parallel_APIs → Cache_Results
├── Data_Quality → Source_Health → Fallback_Check → Validation
├── Performance → Response_Times → Memory_Usage → Optimization
└── Security → Vulnerability_Scan → Compliance_Check → Remediation
```

## 🔧 COMMAND SHORTCUTS

### Development Workflow

```bash
# Clean environment (port conflicts)
npm run dev:clean

# Type safety (mandatory before commits)
npm run type-check

# TDD testing (real APIs only)
npm test

# Performance validation
npm run test:performance:memory

# Production build
npm run build
```

### Debugging Commands

```bash
# System health
curl localhost:3000/api/health

# Service monitoring
# Navigate to /admin in browser

# Memory optimization
export NODE_OPTIONS="--max-old-space-size=8192"

# Verbose test debugging
npm test -- --verbose --testNamePattern="ServiceName"

# Performance monitoring
npm run dev:monitor
```

## 🚦 SYSTEM STATE INDICATORS

### State Recognition (Visual Cues)

```
HEALTHY   → /api/health: 200 OK + Admin dashboard: All green
DEGRADED  → Some APIs yellow/red + Response times 3-10s
UNSTABLE  → Memory warnings + Timeouts + Response > 10s
CRITICAL  → Multiple failures + 500 errors + System unresponsive
```

### Auto-Recovery Triggers

```
API_Rate_Limit (429)     → FallbackDataService activates automatically
Redis_Connection_Lost    → In-memory cache fallback activates
Memory_Pressure         → Garbage collection triggers
Cache_Miss_Rate_>30%    → TTL increase + cache warming
Service_Timeout         → Circuit breaker pattern activates
```

## 📋 IMMEDIATE ACTION CHECKLIST

### Before Making ANY Code Changes

- [ ] `npm run type-check` returns 0 errors
- [ ] `/api/health` returns 200 OK
- [ ] Admin dashboard shows acceptable API status
- [ ] No port conflicts on 3000

### Before Running Tests

- [ ] Export NODE_OPTIONS if memory constrained
- [ ] Verify real API connectivity
- [ ] Check Redis status (fallback OK if down)
- [ ] Ensure clean environment (`dev:clean` if needed)

### Before Deployment/Build

- [ ] All tests pass with real data
- [ ] TypeScript compilation clean
- [ ] Performance benchmarks met (<3s analysis)
- [ ] Security validation complete

## 🎛️ CONFIGURATION MATRIX

### Memory Settings by Task

```
Task_Type              → NODE_OPTIONS                     → Jest_Config
Development           → --max-old-space-size=4096       → maxWorkers: 1
Heavy_Testing         → --max-old-space-size=8192       → runInBand: true
Performance_Analysis  → --expose-gc --trace-gc          → logHeapUsage: true
Production_Build      → --max-old-space-size=4096       → Standard
```

### API Fallback Priority

```
Primary:    Polygon → Alpha Vantage → FMP
Secondary:  EODHD → TwelveData
Government: SEC EDGAR → FRED → BLS → EIA
Backup:     Yahoo Finance (emergency only)
```

## 🔍 QUICK DIAGNOSTIC PATTERNS

### Error Pattern Recognition

```
"EADDRINUSE"           → Port conflict → npm run dev:clean
"heap out of memory"   → Memory issue → Increase NODE_OPTIONS
"ECONNREFUSED"         → Redis down → Auto-fallback active
"429 Too Many"         → Rate limit → Check admin panel
"Cannot find module"   → Dependency → npm install
"Type error"           → TypeScript → npm run type-check
```

### Service Status Quick Check

```
Service_Unresponsive  → /api/health endpoint check
Data_Quality_Issues   → /admin dashboard review
Performance_Degraded  → npm run test:performance
Security_Concerns     → Security test suite run
Cache_Problems        → Redis connectivity test
```

## 💡 AI AGENT ASSUMPTIONS (Critical)

### Always True Assumptions

- NO MOCK DATA EVER (real APIs only)
- TypeScript strict mode required
- TDD approach with real API testing
- Sub-3-second analysis performance target
- OWASP Top 10 security compliance
- Redis with in-memory fallback
- Graceful degradation on failures

### Never Do List

- ❌ Use mock data in tests
- ❌ Ignore TypeScript errors
- ❌ Skip security validation
- ❌ Deploy without performance validation
- ❌ Commit code with failing tests
- ❌ Use production APIs in tests without rate limiting

### Always Do List

- ✅ Validate system health before tasks
- ✅ Use real APIs with proper timeouts
- ✅ Implement graceful error handling
- ✅ Cache results for performance
- ✅ Follow service layer patterns
- ✅ Maintain security compliance

---

**Reference Integration**: Use Context7 MCP for real-time API documentation
**Emergency Contact**: Full system documentation in `/CLAUDE.md`
**Last Updated**: 2025-09-28
