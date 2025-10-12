# SEC EDGAR Integration - Implementation Checklist

**Quick reference for implementation tasks**

## Pre-Implementation

- [ ] Review `SEC_EDGAR_INTEGRATION_ARCHITECTURE.md` (full design)
- [ ] Review `SEC_EDGAR_ARCHITECTURE_SUMMARY.md` (quick reference)
- [ ] Review `SEC_EDGAR_INTEGRATION_DIAGRAMS.md` (visual diagrams)
- [ ] Understand current errors:
  - Line 88: Missing `mapInsiderTransactionFromInstitutional()`
  - Line 136: Missing `secAPI` property

---

## Phase 1: Type Mapping (2-3 hours)

### File: `HybridSmartMoneyDataService.ts`

**1.1 Add secAPI Property**
- [ ] Line 50: Add `private secAPI: SECEdgarAPI;`
- [ ] Add import: `import { SECEdgarAPI } from '../../financial-data/SECEdgarAPI';`
- [ ] Line 56: Initialize: `this.secAPI = new SECEdgarAPI();`
- [ ] Remove temporary mock stub

**1.2 Add Type Mapping Method**
- [ ] Add `mapInsiderTransactionFromInstitutional()` method
  ```typescript
  private mapInsiderTransactionFromInstitutional(
    secTx: import('../../financial-data/types').InsiderTransaction,
    symbol: string
  ): InsiderTransaction {
    return {
      symbol,
      filingDate: secTx.filingDate,
      transactionDate: secTx.transactionDate,
      transactionType: this.convertTransactionType(secTx.transactionCode),
      securitiesTransacted: secTx.shares,
      price: secTx.pricePerShare || 0,
      securitiesOwned: secTx.sharesOwnedAfter,
      typeOfOwner: secTx.relationship.join(', ') || 'Unknown',
      reportingName: secTx.reportingOwnerName,
    };
  }
  ```

**1.3 Add Transaction Code Converter**
- [ ] Add `convertTransactionType()` helper
  ```typescript
  private convertTransactionType(code: string): 'P' | 'S' {
    const buyCodesMap = new Set(['P', 'A', 'J']);
    return buyCodesMap.has(code) ? 'P' : 'S';
  }
  ```

**1.4 Update getInsiderTrading Method**
- [ ] Line 88: Change `this.mapInsiderTransaction(t, symbol)` to `this.mapInsiderTransactionFromInstitutional(t, symbol)`
- [ ] Verify cache integration unchanged

**1.5 Update getInstitutionalOwnership Method**
- [ ] Line 136: Change to use `this.secAPI.get13FHoldings(symbol, 4)`
- [ ] Verify cache integration unchanged

**1.6 Validation**
- [ ] Run: `npm run type-check`
- [ ] Should pass with no TypeScript errors
- [ ] Git commit: "Add SEC EDGAR type mapping to HybridSmartMoneyDataService"

---

## Phase 2: XML Parsing Implementation (4-6 hours)

### Install Dependencies

**2.1 Install xml2js**
- [ ] Run: `npm install xml2js`
- [ ] Run: `npm install --save-dev @types/xml2js`
- [ ] Verify installation in `package.json`

### File: `SECEdgarAPI.ts`

**2.2 Add Import**
- [ ] Add: `import * as xml2js from 'xml2js';`

**2.3 Implement parseXML Helper**
- [ ] Add method after existing helpers:
  ```typescript
  private async parseXML(xmlString: string): Promise<any> {
    try {
      const result = await xml2js.parseStringPromise(xmlString, {
        explicitArray: false,
        ignoreAttrs: false,
        trim: true,
      });
      return result;
    } catch (error) {
      throw new Error(`XML parsing failed: ${error.message}`);
    }
  }
  ```

**2.4 Replace parse13FHoldings (Lines 470-508)**
- [ ] Delete existing mock implementation
- [ ] Implement real XML parsing:
  ```typescript
  private async parse13FHoldings(
    symbol: string,
    filingData: string,
    filing: { filingDate: string; accessionNumber: string }
  ): Promise<InstitutionalHolding[]> {
    const holdings: InstitutionalHolding[] = [];

    try {
      const xml = await this.parseXML(filingData);
      const holdingsTable = this.extractHoldingsTable(xml);
      const filtered = this.filterBySymbol(holdingsTable, symbol);

      for (const holding of filtered) {
        try {
          const parsed = this.mapXMLToHolding(holding, filing);
          if (this.validateHolding(parsed)) {
            holdings.push(parsed);
          }
        } catch (error) {
          console.warn(`Skipping invalid holding: ${error.message}`);
          continue;
        }
      }
    } catch (error) {
      console.error(`Failed to parse 13F holdings: ${error.message}`);
      return [];
    }

    return holdings;
  }
  ```

**2.5 Replace parseForm4Transactions (Lines 513-556)**
- [ ] Delete existing mock implementation
- [ ] Implement real XML parsing:
  ```typescript
  private async parseForm4Transactions(
    symbol: string,
    filingData: string,
    filing: {
      filingDate: string;
      accessionNumber: string;
      form: string;
    }
  ): Promise<InsiderTransaction[]> {
    const transactions: InsiderTransaction[] = [];

    try {
      const xml = await this.parseXML(filingData);
      const owner = this.extractReportingOwner(xml);
      const txs = this.extractNonDerivativeTransactions(xml);

      for (const tx of txs) {
        try {
          const parsed = this.mapXMLToTransaction(tx, owner, filing, symbol);
          if (this.validateTransaction(parsed)) {
            transactions.push(parsed);
          }
        } catch (error) {
          console.warn(`Skipping invalid transaction: ${error.message}`);
          continue;
        }
      }
    } catch (error) {
      console.error(`Failed to parse Form 4 transactions: ${error.message}`);
      return [];
    }

    return transactions;
  }
  ```

**2.6 Add 13F Helper Methods**
- [ ] Add `extractHoldingsTable(xml)`:
  ```typescript
  private extractHoldingsTable(xml: any): any[] {
    try {
      // Navigate XML structure to find holdings
      const table = xml?.informationTable?.infoTable || [];
      return Array.isArray(table) ? table : [table];
    } catch {
      return [];
    }
  }
  ```

- [ ] Add `filterBySymbol(holdings, symbol)`:
  ```typescript
  private filterBySymbol(holdings: any[], symbol: string): any[] {
    // Need CUSIP mapping - start with simple name matching
    const targetName = symbol.toUpperCase();
    return holdings.filter(h =>
      h?.nameOfIssuer?.toUpperCase().includes(targetName)
    );
  }
  ```

- [ ] Add `mapXMLToHolding(xml, filing)`:
  ```typescript
  private mapXMLToHolding(
    xmlHolding: any,
    filing: { filingDate: string; accessionNumber: string }
  ): InstitutionalHolding {
    return {
      symbol: xmlHolding.nameOfIssuer || '',
      cusip: xmlHolding.cusip || '',
      securityName: xmlHolding.nameOfIssuer || '',
      managerName: 'Unknown', // From parent filing context
      managerId: 'Unknown',
      reportDate: filing.filingDate,
      filingDate: filing.filingDate,
      shares: parseInt(xmlHolding.shrsOrPrnAmt?.sshPrnamt || '0'),
      marketValue: parseInt(xmlHolding.value || '0') * 1000, // Value in thousands
      percentOfPortfolio: 0, // Calculate later
      isNewPosition: false,
      isClosedPosition: false,
      rank: 0,
      securityType: xmlHolding.titleOfClass === 'COM' ? 'COM' : 'OTHER',
      investmentDiscretion: xmlHolding.investmentDiscretion || 'SOLE',
      timestamp: Date.now(),
      source: 'sec_edgar',
      accessionNumber: filing.accessionNumber,
    };
  }
  ```

- [ ] Add `validateHolding(holding)`:
  ```typescript
  private validateHolding(holding: InstitutionalHolding): boolean {
    return !!(
      holding.symbol &&
      holding.managerName &&
      holding.shares > 0 &&
      holding.marketValue > 0
    );
  }
  ```

**2.7 Add Form 4 Helper Methods**
- [ ] Add `extractReportingOwner(xml)`:
  ```typescript
  private extractReportingOwner(xml: any): {
    name: string;
    title?: string;
    cik: string;
    relationship: string[];
  } {
    const owner = xml?.ownershipDocument?.reportingOwner || {};
    const relationship = [];

    if (owner.reportingOwnerRelationship?.isDirector === '1') {
      relationship.push('Director');
    }
    if (owner.reportingOwnerRelationship?.isOfficer === '1') {
      relationship.push('Officer');
      if (owner.reportingOwnerRelationship?.officerTitle) {
        relationship.push(owner.reportingOwnerRelationship.officerTitle);
      }
    }
    if (owner.reportingOwnerRelationship?.isTenPercentOwner === '1') {
      relationship.push('10% Owner');
    }

    return {
      name: owner.reportingOwnerId?.rptOwnerName || 'Unknown',
      title: owner.reportingOwnerRelationship?.officerTitle,
      cik: owner.reportingOwnerId?.rptOwnerCik || '',
      relationship,
    };
  }
  ```

- [ ] Add `extractNonDerivativeTransactions(xml)`:
  ```typescript
  private extractNonDerivativeTransactions(xml: any): any[] {
    try {
      const table = xml?.ownershipDocument?.nonDerivativeTable?.nonDerivativeTransaction || [];
      return Array.isArray(table) ? table : [table];
    } catch {
      return [];
    }
  }
  ```

- [ ] Add `mapXMLToTransaction(xml, owner, filing, symbol)`:
  ```typescript
  private mapXMLToTransaction(
    xmlTx: any,
    reportingOwner: any,
    filing: any,
    symbol: string
  ): InsiderTransaction {
    const transactionCode = xmlTx.transactionCoding?.transactionCode || 'S';
    const shares = parseInt(xmlTx.transactionAmounts?.transactionShares || '0');
    const pricePerShare = parseFloat(xmlTx.transactionAmounts?.transactionPricePerShare || '0');

    return {
      symbol: symbol.toUpperCase(),
      companyName: symbol,
      reportingOwnerName: reportingOwner.name,
      reportingOwnerTitle: reportingOwner.title,
      reportingOwnerId: reportingOwner.cik,
      relationship: reportingOwner.relationship,
      transactionDate: xmlTx.transactionDate || filing.filingDate,
      filingDate: filing.filingDate,
      transactionCode: transactionCode as any,
      transactionType: transactionCode === 'P' || transactionCode === 'A' ? 'BUY' : 'SELL',
      securityTitle: xmlTx.securityTitle || 'Common Stock',
      shares,
      pricePerShare,
      transactionValue: shares * pricePerShare,
      sharesOwnedAfter: parseInt(xmlTx.postTransactionAmounts?.sharesOwnedFollowingTransaction || '0'),
      ownershipType: 'D',
      isAmendment: filing.form.includes('/A'),
      isDerivative: false,
      confidence: 0.95,
      timestamp: Date.now(),
      source: 'sec_edgar',
      accessionNumber: filing.accessionNumber,
      formType: filing.form as '4' | '4/A',
    };
  }
  ```

- [ ] Add `validateTransaction(tx)`:
  ```typescript
  private validateTransaction(tx: InsiderTransaction): boolean {
    return !!(
      tx.symbol &&
      tx.reportingOwnerName &&
      tx.transactionDate &&
      tx.shares > 0
    );
  }
  ```

**2.8 Update Method Signatures**
- [ ] Change `parse13FHoldings()` from sync to async
- [ ] Change `parseForm4Transactions()` from sync to async
- [ ] Update calling code to await these methods

**2.9 Validation**
- [ ] Run: `npm run type-check`
- [ ] Should pass with no errors
- [ ] Git commit: "Implement real XML parsing for SEC EDGAR filings"

---

## Phase 3: Integration Testing (2-3 hours)

### Create Test Script

**3.1 Test Insider Trading Data**
- [ ] Create: `scripts/ml/test-sec-edgar-parsing.ts`
- [ ] Test with: `npx tsx scripts/ml/test-sec-edgar-parsing.ts --symbol AAPL`
- [ ] Verify: Returns real Form 4 data (not mock)
- [ ] Verify: Second run hits cache (should be fast)

**3.2 Test Institutional Ownership**
- [ ] Test with: `npx tsx scripts/ml/test-sec-edgar-parsing.ts --symbol MSFT --type 13f`
- [ ] Verify: Returns real 13F data (not mock)
- [ ] Verify: Cache working properly

**3.3 Test Error Handling**
- [ ] Test invalid symbol: `--symbol INVALID_SYMBOL`
- [ ] Verify: Returns empty array `[]`, not crash
- [ ] Test symbol with no filings: `--symbol XYZ`
- [ ] Verify: Returns empty array `[]`, not crash

**3.4 Test Rate Limiting**
- [ ] Test with 20+ symbols
- [ ] Monitor request timing
- [ ] Verify: ~100ms between requests
- [ ] Verify: No HTTP 429 errors from SEC

**3.5 Test Cache Performance**
- [ ] First run: `time npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --symbols AAPL`
- [ ] Second run: `time npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --symbols AAPL`
- [ ] Verify: Second run >90% faster
- [ ] Check cache files created in `data/cache/smart-money/`

**3.6 Test End-to-End**
- [ ] Run: `npx tsx scripts/ml/test-smart-money-features.ts --symbol AAPL`
- [ ] Verify: All 20 smart money features extracted
- [ ] Verify: Real SEC data in features
- [ ] Verify: No TypeScript errors

**3.7 Validation**
- [ ] All tests pass
- [ ] No crashes on errors
- [ ] Cache hit rate >95% on second run
- [ ] Real data (not mock) in output
- [ ] Git commit: "Add SEC EDGAR integration tests"

---

## Phase 4: Documentation (1-2 hours)

**4.1 Update Inline Documentation**
- [ ] Remove "mock" comments from parsing methods
- [ ] Add XML structure documentation
- [ ] Document error handling behavior
- [ ] Add JSDoc comments to new helper methods

**4.2 Update CLAUDE.md**
- [ ] Add note: "SEC EDGAR parsing is REAL, not mock"
- [ ] Document xml2js dependency
- [ ] Add troubleshooting section for parsing errors
- [ ] Update data source list

**4.3 Create Integration Guide**
- [ ] Document SEC EDGAR data structure
- [ ] Provide example XML snippets
- [ ] Document common parsing issues
- [ ] Add CUSIP mapping notes

**4.4 Update README Files**
- [ ] Update `/app/services/financial-data/CLAUDE.md`
- [ ] Note SEC EDGAR is production-ready
- [ ] Document Form 4 and 13F support

**4.5 Validation**
- [ ] Documentation is clear and accurate
- [ ] Examples tested and working
- [ ] Troubleshooting guide helpful
- [ ] Git commit: "Update documentation for SEC EDGAR integration"

---

## Final Validation

**Pre-Deployment Checklist**
- [ ] All TypeScript errors resolved
- [ ] All tests passing
- [ ] Cache working (>95% hit rate)
- [ ] Rate limiting respected (10 req/sec)
- [ ] Error handling graceful (no crashes)
- [ ] Real data (not mock) in production
- [ ] Documentation updated
- [ ] Code reviewed

**Performance Validation**
- [ ] Dataset generation completes successfully
- [ ] First run: reasonable time (<5 min for 500 stocks)
- [ ] Second run: >90% cache hit rate
- [ ] No HTTP 429 errors from SEC
- [ ] Cache files created in correct directories

**Quality Validation**
- [ ] Run: `npm run type-check` ✅
- [ ] Run: `npm run lint` ✅
- [ ] Run: `npm test` ✅
- [ ] Review git diff for unintended changes
- [ ] Clean up any debug logging

---

## Git Workflow

**Commits:**
1. [ ] "Add SEC EDGAR type mapping to HybridSmartMoneyDataService"
2. [ ] "Implement real XML parsing for SEC EDGAR filings"
3. [ ] "Add SEC EDGAR integration tests"
4. [ ] "Update documentation for SEC EDGAR integration"

**Final Push:**
- [ ] Create feature branch: `git checkout -b feature/sec-edgar-integration`
- [ ] Push commits: `git push origin feature/sec-edgar-integration`
- [ ] Create pull request
- [ ] Request code review
- [ ] Merge after approval

---

## Rollback Plan (If Needed)

**If integration fails:**
1. [ ] Revert commits: `git revert HEAD~4..HEAD`
2. [ ] Keep `secAPI` as mock stub
3. [ ] Use `InstitutionalDataService` fallback
4. [ ] Set SEC feature values to 0
5. [ ] Document as "not implemented"
6. [ ] Investigate root cause
7. [ ] Fix issues
8. [ ] Re-attempt integration

---

## Post-Deployment

**Monitor:**
- [ ] Check error logs for XML parsing failures
- [ ] Monitor SEC API rate limiting
- [ ] Track cache hit rate
- [ ] Verify data quality in training datasets

**Iterate:**
- [ ] Add more symbols to CUSIP mapping
- [ ] Improve XML parsing for edge cases
- [ ] Optimize cache performance
- [ ] Add more comprehensive error handling

---

## Success Metrics

**Must Have ✅**
- [ ] `npm run type-check` passes
- [ ] Real SEC data (not mock)
- [ ] Empty arrays on errors (no crashes)
- [ ] Rate limiting: 10 req/sec
- [ ] Cache hit rate: >95%

**Nice to Have 🎯**
- [ ] Parse 95%+ of filings successfully
- [ ] CUSIP → Symbol mapping for top 500 stocks
- [ ] Handle all SEC XML schema variations
- [ ] Comprehensive error reporting

---

**Estimated Total Time:** 9-14 hours

**Document End**
