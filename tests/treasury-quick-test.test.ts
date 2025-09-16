/**
 * Quick Treasury Service Test
 * Simplified test to validate Treasury API connectivity
 */

import { treasuryFiscalService } from '../app/services/mcp/collectors/TreasuryFiscalService'

describe('Treasury Quick Test', () => {
  const TEST_TIMEOUT = 15000

  it('should fetch federal debt data', async () => {
    console.log('🏛️ Testing Treasury federal debt endpoint...')

    const response = await treasuryFiscalService.getDebtToPenny(undefined, undefined, 3)

    expect(response).toHaveProperty('dataType', 'Treasury Debt to the Penny')
    expect(response.data).toHaveProperty('latestDebt')
    expect(response.data.latestDebt.amount).toBeGreaterThan(30_000_000_000_000)

    console.log(`✅ Success: Federal debt is $${response.data.latestDebt.amountTrillions}`)
  }, TEST_TIMEOUT)

  it('should fetch exchange rates data', async () => {
    console.log('🏛️ Testing Treasury exchange rates endpoint...')

    const response = await treasuryFiscalService.getExchangeRates(undefined, 3)

    expect(response).toHaveProperty('dataType', 'Treasury Exchange Rates')
    expect(response.data).toHaveProperty('exchangeRates')
    expect(Array.isArray(response.data.exchangeRates)).toBe(true)

    if (response.data.exchangeRates.length > 0) {
      expect(response.data.exchangeRates[0]).toHaveProperty('currency')
      expect(response.data.exchangeRates[0]).toHaveProperty('exchangeRate')
    }

    console.log(`✅ Success: Found ${response.data.exchangeRates.length} exchange rates`)
  }, TEST_TIMEOUT)

  it('should fetch operating cash balance data', async () => {
    console.log('🏛️ Testing Treasury operating cash balance endpoint...')

    const response = await treasuryFiscalService.getOperatingCashBalance(undefined, 3)

    expect(response).toHaveProperty('dataType', 'Treasury Operating Cash Balance')
    expect(response.data).toHaveProperty('cashBalances')
    expect(Array.isArray(response.data.cashBalances)).toBe(true)

    if (response.data.cashBalances.length > 0) {
      expect(response.data.cashBalances[0]).toHaveProperty('date')
      expect(response.data.cashBalances[0]).toHaveProperty('closingBalance')
    }

    console.log(`✅ Success: Found ${response.data.cashBalances.length} cash balance records`)
  }, TEST_TIMEOUT)
})