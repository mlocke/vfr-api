import "dotenv/config";
import { FinancialModelingPrepAPI } from "../../app/services/financial-data/FinancialModelingPrepAPI.js";

(async () => {
  const fmp = new FinancialModelingPrepAPI();
  
  console.log('Testing FMP Premium Endpoints...\n');
  
  // Test the makeRequest method directly
  try {
    const response = await (fmp as any).makeRequest('/earnings-surprises/AAPL');
    console.log('✓ /earnings-surprises/ works!');
    console.log(`  Records: ${response.data?.length || 0}`);
  } catch (e: any) {
    console.log('✗ /earnings-surprises/ failed:', e.message);
  }
})();
