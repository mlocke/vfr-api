/**
 * Diagnostic script to understand SEC EDGAR submissions structure
 */

import { SECEdgarAPI } from "./app/services/financial-data/SECEdgarAPI";

async function diagnoseFilings() {
  const api = new SECEdgarAPI();

  const symbol = "AAPL";
  console.log(`Diagnosing filings for ${symbol}...\n`);

  // Get CIK
  const cik = await (api as any).symbolToCik(symbol);
  console.log(`CIK: ${cik}\n`);

  // Get submissions
  const submissions = await (api as any).getCompanySubmissions(cik);

  if (!submissions || !submissions.filings?.recent) {
    console.log("No submissions found");
    return;
  }

  const forms = submissions.filings.recent.form || [];
  const dates = submissions.filings.recent.filingDate || [];

  console.log(`Total recent filings: ${forms.length}\n`);

  // Count by form type
  const formCounts = new Map<string, number>();
  forms.forEach((form: string) => {
    formCounts.set(form, (formCounts.get(form) || 0) + 1);
  });

  console.log("Filings by type:");
  Array.from(formCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([form, count]) => {
      console.log(`  ${form}: ${count}`);
    });

  console.log("\nForm 4 filings:");
  const form4s = forms
    .map((form: string, i: number) => ({ form, date: dates[i], index: i }))
    .filter((f: any) => f.form === "4" || f.form === "4/A");

  if (form4s.length > 0) {
    console.log(`Found ${form4s.length} Form 4 filings:`);
    form4s.slice(0, 5).forEach((f: any) => {
      console.log(`  ${f.date}: ${f.form}`);
    });
  } else {
    console.log("No Form 4 filings found in company submissions.");
    console.log("\nThis is expected! Form 4 filings are filed BY INSIDERS (executives,");
    console.log("directors) with their own CIKs, not by the company itself.");
    console.log("\nTo get Form 4 filings for a company's stock, we need to:");
    console.log("1. Use SEC EDGAR's full-text search API");
    console.log("2. Query a database that maps insiders to companies");
    console.log("3. Use a third-party data provider");
  }

  console.log("\n13F filings:");
  const thirteenFs = forms
    .map((form: string, i: number) => ({ form, date: dates[i] }))
    .filter((f: any) => f.form === "13F-HR" || f.form === "13F-HR/A");

  if (thirteenFs.length > 0) {
    console.log(`Found ${thirteenFs.length} 13F filings:`);
    thirteenFs.slice(0, 5).forEach((f: any) => {
      console.log(`  ${f.date}: ${f.form}`);
    });
  } else {
    console.log("No 13F filings found.");
    console.log("This is expected - 13F filings are filed BY INSTITUTIONAL INVESTORS,");
    console.log("not by the company whose stock is held.");
  }

  console.log("\nCompany's own filings (10-K, 10-Q, etc.):");
  const companyFilings = forms
    .map((form: string, i: number) => ({ form, date: dates[i] }))
    .filter((f: any) => f.form.startsWith("10-") || f.form.startsWith("8-"));

  if (companyFilings.length > 0) {
    console.log(`Found ${companyFilings.length} company filings (first 5):`);
    companyFilings.slice(0, 5).forEach((f: any) => {
      console.log(`  ${f.date}: ${f.form}`);
    });
  }
}

diagnoseFilings();
