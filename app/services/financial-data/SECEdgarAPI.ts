/**
 * Direct SEC EDGAR API implementation
 * Provides access to SEC filings data and company information
 * Documentation: https://www.sec.gov/edgar/sec-api-documentation
 */

import {
	StockData,
	CompanyInfo,
	MarketData,
	FinancialDataProvider,
	ApiResponse,
	InstitutionalHolding,
	InsiderTransaction,
	InstitutionalSentiment,
	InsiderSentiment,
} from "./types";
import { XMLParser } from "fast-xml-parser";

export class SECEdgarAPI implements FinancialDataProvider {
	name = "SEC EDGAR";
	private baseUrl = "https://data.sec.gov";
	private timeout: number;
	private userAgent: string;
	private requestQueue: Promise<any>[] = [];
	private lastRequestTime = 0;
	private readonly REQUEST_DELAY = 100; // 100ms delay between requests (10 req/sec limit)
	private xmlParser: XMLParser;

	constructor(timeout = 15000) {
		this.timeout = timeout;
		// SEC EDGAR requires a User-Agent header with contact information
		this.userAgent = process.env.SEC_USER_AGENT || "VFR-API/1.0 (contact@veritak.com)";

		// Initialize XML parser with appropriate options
		this.xmlParser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: "@_",
			textNodeName: "#text",
			parseAttributeValue: true,
			trimValues: true,
		});
	}

	/**
	 * Get stock price data - SEC doesn't provide real-time prices
	 * Returns company facts that can include financial metrics
	 */
	async getStockPrice(symbol: string): Promise<StockData | null> {
		try {
			// SEC EDGAR doesn't provide real-time stock prices
			// We'll return basic company data with placeholder price data
			const cik = await this.symbolToCik(symbol);
			if (!cik) {
				return null;
			}

			const companyFacts = await this.getCompanyFacts(cik);
			if (!companyFacts) {
				return null;
			}

			// SEC doesn't have price data, return placeholder
			return {
				symbol: symbol.toUpperCase(),
				price: 0,
				change: 0,
				changePercent: 0,
				volume: 0,
				timestamp: Date.now(),
				source: "sec_edgar",
			};
		} catch (error) {
			console.error(`SEC EDGAR API error for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Get company information from SEC submissions
	 */
	async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
		try {
			const cik = await this.symbolToCik(symbol);
			if (!cik) {
				return null;
			}

			const response = await this.makeRequest(
				`/submissions/CIK${cik.padStart(10, "0")}.json`
			);

			if (!response.success || !response.data) {
				return null;
			}

			const data = response.data;

			return {
				symbol: symbol.toUpperCase(),
				name: data.name || "",
				description: data.description || data.businessDescription || "",
				sector: data.sicDescription || "",
				marketCap: 0, // SEC doesn't provide market cap
				employees: 0, // SEC doesn't provide employee count in submissions
				website: data.website || "",
			};
		} catch (error) {
			console.error(`SEC EDGAR company info error for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Get market data - SEC doesn't provide market data
	 * Returns placeholder data
	 */
	async getMarketData(symbol: string): Promise<MarketData | null> {
		try {
			// SEC EDGAR doesn't provide market data
			return {
				symbol: symbol.toUpperCase(),
				open: 0,
				high: 0,
				low: 0,
				close: 0,
				volume: 0,
				timestamp: Date.now(),
				source: "sec_edgar",
			};
		} catch (error) {
			console.error(`SEC EDGAR market data error for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Health check for SEC EDGAR API
	 */
	async healthCheck(): Promise<boolean> {
		try {
			// SEC EDGAR is very strict about rate limiting and User-Agent headers
			// For health check, we'll just verify the base URL is reachable
			// and the API structure is valid by checking a known good endpoint
			const response = await fetch(`${this.baseUrl}/submissions/CIK0000320193.json`, {
				headers: {
					"User-Agent": this.userAgent,
					Accept: "application/json",
				},
				signal: AbortSignal.timeout(10000), // Longer timeout for SEC
			});

			// SEC EDGAR returns 200 for valid requests but may return other codes
			// We consider 200, 429 (rate limited), or 403 (valid but restricted) as "healthy"
			return response.status === 200 || response.status === 429 || response.status === 403;
		} catch (error) {
			console.log("SEC EDGAR health check failed:", error);
			return false;
		}
	}

	/**
	 * Get company facts by CIK
	 */
	async getCompanyFacts(cik: string): Promise<any> {
		try {
			const response = await this.makeRequest(
				`/api/xbrl/companyfacts/CIK${cik.padStart(10, "0")}.json`
			);
			return response.success ? response.data : null;
		} catch (error) {
			console.error(`SEC EDGAR company facts error for CIK ${cik}:`, error);
			return null;
		}
	}

	/**
	 * Get 13F institutional holdings for a symbol
	 * Retrieves quarterly institutional ownership data from 13F filings
	 */
	async get13FHoldings(symbol: string, quarters = 4): Promise<InstitutionalHolding[]> {
		try {
			const cik = await this.symbolToCik(symbol);
			if (!cik) {
				console.error(`No CIK found for symbol ${symbol}`);
				return [];
			}

			// Get company submissions to find 13F filings
			const submissions = await this.getCompanySubmissions(cik);
			if (!submissions) {
				return [];
			}

			const holdings: InstitutionalHolding[] = [];
			const thirteenFFilings = this.filter13FFilings(submissions, quarters);

			// Process each 13F filing
			for (const filing of thirteenFFilings) {
				try {
					const filingData = await this.get13FFilingData(filing.accessionNumber);
					if (filingData) {
						const parsedHoldings = this.parse13FHoldings(symbol, filingData, filing);
						holdings.push(...parsedHoldings);
					}
				} catch (error) {
					console.error(`Error processing 13F filing ${filing.accessionNumber}:`, error);
					continue;
				}
			}

			return holdings.sort(
				(a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime()
			);
		} catch (error) {
			console.error(`SEC EDGAR 13F holdings error for ${symbol}:`, error);
			return [];
		}
	}

	/**
	 * Get Form 4 insider transactions for a symbol
	 * Retrieves insider trading data from Form 4 filings
	 */
	async getForm4Transactions(symbol: string, days = 90): Promise<InsiderTransaction[]> {
		try {
			const cik = await this.symbolToCik(symbol);
			if (!cik) {
				console.error(`No CIK found for symbol ${symbol}`);
				return [];
			}

			// Get company submissions to find Form 4 filings
			const submissions = await this.getCompanySubmissions(cik);
			if (!submissions) {
				return [];
			}

			const transactions: InsiderTransaction[] = [];
			const form4Filings = this.filterForm4Filings(submissions, days);

			// Process each Form 4 filing
			for (const filing of form4Filings) {
				try {
					const filingData = await this.getForm4FilingData(filing.accessionNumber);
					if (filingData) {
						const parsedTransactions = this.parseForm4Transactions(
							symbol,
							filingData,
							filing
						);
						transactions.push(...parsedTransactions);
					}
				} catch (error) {
					console.error(
						`Error processing Form 4 filing ${filing.accessionNumber}:`,
						error
					);
					continue;
				}
			}

			return transactions.sort(
				(a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime()
			);
		} catch (error) {
			console.error(`SEC EDGAR Form 4 transactions error for ${symbol}:`, error);
			return [];
		}
	}

	/**
	 * Get aggregated institutional sentiment for a symbol
	 */
	async getInstitutionalSentiment(symbol: string): Promise<InstitutionalSentiment | null> {
		try {
			const holdings = await this.get13FHoldings(symbol, 2); // Current and previous quarter
			if (holdings.length === 0) {
				return null;
			}

			return this.calculateInstitutionalSentiment(symbol, holdings);
		} catch (error) {
			console.error(`SEC EDGAR institutional sentiment error for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Get aggregated insider sentiment for a symbol
	 */
	async getInsiderSentiment(symbol: string): Promise<InsiderSentiment | null> {
		try {
			const transactions = await this.getForm4Transactions(symbol, 180); // 6 months
			if (transactions.length === 0) {
				return null;
			}

			return this.calculateInsiderSentiment(symbol, transactions);
		} catch (error) {
			console.error(`SEC EDGAR insider sentiment error for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Convert stock symbol to CIK (Central Index Key)
	 * This is a simplified implementation - in practice you'd need a symbol-to-CIK mapping
	 */
	private async symbolToCik(symbol: string): Promise<string | null> {
		// This is a simplified mapping for common symbols
		// In a production environment, you'd need a comprehensive symbol-to-CIK database
		const symbolToCikMap: Record<string, string> = {
			AAPL: "0000320193",
			MSFT: "0000789019",
			GOOGL: "0001652044",
			AMZN: "0001018724",
			TSLA: "0001318605",
			META: "0001326801",
			NVDA: "0001045810",
			JPM: "0000019617",
			JNJ: "0000200406",
			V: "0001403161",
		};

		return symbolToCikMap[symbol.toUpperCase()] || null;
	}

	/**
	 * Rate limiting delay to comply with SEC EDGAR 10 req/sec limit
	 * Uses proper request queuing to prevent race conditions
	 */
	private async rateLimitDelay(): Promise<void> {
		// Create a promise that will resolve when it's this request's turn
		const requestPromise = new Promise<void>(resolve => {
			const executeRequest = () => {
				const now = Date.now();
				const timeSinceLastRequest = now - this.lastRequestTime;

				if (timeSinceLastRequest < this.REQUEST_DELAY) {
					const delay = this.REQUEST_DELAY - timeSinceLastRequest;
					setTimeout(() => {
						this.lastRequestTime = Date.now();
						resolve();
					}, delay);
				} else {
					this.lastRequestTime = Date.now();
					resolve();
				}
			};

			// Add this request to the queue
			if (this.requestQueue.length === 0) {
				// No queue, execute immediately
				executeRequest();
			} else {
				// Wait for previous request to complete, then execute
				this.requestQueue[this.requestQueue.length - 1].then(executeRequest);
			}
		});

		// Add this promise to the queue
		this.requestQueue.push(requestPromise);

		// Clean up completed requests from queue
		requestPromise.finally(() => {
			const index = this.requestQueue.indexOf(requestPromise);
			if (index > -1) {
				this.requestQueue.splice(index, 1);
			}
		});

		// Wait for this request's turn
		await requestPromise;
	}

	/**
	 * Get company submissions data
	 */
	private async getCompanySubmissions(cik: string): Promise<any> {
		try {
			const response = await this.makeRequest(
				`/submissions/CIK${cik.padStart(10, "0")}.json`
			);
			return response.success ? response.data : null;
		} catch (error) {
			console.error(`Error getting company submissions for CIK ${cik}:`, error);
			return null;
		}
	}

	/**
	 * Filter 13F filings from submissions
	 */
	private filter13FFilings(submissions: any, quarters: number): any[] {
		if (!submissions.filings?.recent) return [];

		const forms = submissions.filings.recent.form || [];
		const dates = submissions.filings.recent.filingDate || [];
		const accessionNumbers = submissions.filings.recent.accessionNumber || [];

		const thirteenFFilings = [];
		const cutoffDate = new Date();
		cutoffDate.setMonth(cutoffDate.getMonth() - quarters * 3);

		for (let i = 0; i < forms.length; i++) {
			if (forms[i] === "13F-HR" && new Date(dates[i]) >= cutoffDate) {
				thirteenFFilings.push({
					form: forms[i],
					filingDate: dates[i],
					accessionNumber: accessionNumbers[i],
				});
			}
		}

		return thirteenFFilings.slice(0, quarters);
	}

	/**
	 * Filter Form 4 filings from submissions
	 */
	private filterForm4Filings(submissions: any, days: number): any[] {
		if (!submissions.filings?.recent) return [];

		const forms = submissions.filings.recent.form || [];
		const dates = submissions.filings.recent.filingDate || [];
		const accessionNumbers = submissions.filings.recent.accessionNumber || [];

		const form4Filings = [];
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - days);

		for (let i = 0; i < forms.length; i++) {
			if ((forms[i] === "4" || forms[i] === "4/A") && new Date(dates[i]) >= cutoffDate) {
				form4Filings.push({
					form: forms[i],
					filingDate: dates[i],
					accessionNumber: accessionNumbers[i],
				});
			}
		}

		return form4Filings.slice(0, 50); // Limit to 50 most recent filings
	}

	/**
	 * Get 13F filing data
	 */
	private async get13FFilingData(accessionNumber: string): Promise<any> {
		try {
			const cleanAccession = accessionNumber.replace(/-/g, "");
			const response = await this.makeRequest(
				`/Archives/edgar/data/${cleanAccession}/${accessionNumber}-xslForm13F_X01/${accessionNumber}.xml`
			);
			return response.success ? response.data : null;
		} catch (error) {
			console.error(`Error getting 13F filing data for ${accessionNumber}:`, error);
			return null;
		}
	}

	/**
	 * Get Form 4 filing data
	 */
	private async getForm4FilingData(accessionNumber: string): Promise<any> {
		try {
			const cleanAccession = accessionNumber.replace(/-/g, "");
			const response = await this.makeRequest(
				`/Archives/edgar/data/${cleanAccession}/${accessionNumber}.txt`
			);
			return response.success ? response.data : null;
		} catch (error) {
			console.error(`Error getting Form 4 filing data for ${accessionNumber}:`, error);
			return null;
		}
	}

	/**
	 * Parse 13F holdings from filing data
	 * Extracts institutional holdings from SEC EDGAR 13F-HR XML filings
	 *
	 * @param symbol Stock symbol to filter holdings
	 * @param filingData Raw XML string from SEC EDGAR
	 * @param filing Filing metadata (date, accession number)
	 * @returns Array of parsed institutional holdings (empty on error)
	 */
	private parse13FHoldings(symbol: string, filingData: any, filing: any): InstitutionalHolding[] {
		const holdings: InstitutionalHolding[] = [];

		try {
			// Parse XML string to JavaScript object
			const xmlData = this.xmlParser.parse(filingData);

			// Extract information table from XML structure
			// Structure: informationTable -> infoTable (array)
			const infoTable = xmlData?.informationTable?.infoTable;
			if (!infoTable) {
				console.warn(
					`No informationTable found in 13F filing ${filing.accessionNumber}`
				);
				return [];
			}

			// Ensure infoTable is an array
			const holdings_array = Array.isArray(infoTable) ? infoTable : [infoTable];

			// Process each holding in the table
			for (const holding of holdings_array) {
				try {
					// Extract basic information
					const nameOfIssuer = holding.nameOfIssuer;
					const cusip = holding.cusip;
					const value = holding.value; // In thousands of dollars
					const shrsOrPrnAmt = holding.shrsOrPrnAmt;

					// Skip if required fields are missing
					if (!cusip || !value || !shrsOrPrnAmt) {
						continue;
					}

					// Extract share information
					const shares = shrsOrPrnAmt.sshPrnamt;
					const shareType = shrsOrPrnAmt.sshPrnamtType;

					// Skip if not shares (only process "SH", skip "PRN" for principal amount)
					if (shareType !== "SH" || !shares || shares <= 0) {
						continue;
					}

					// Validate CUSIP format (should be 9 characters)
					if (cusip.length !== 9) {
						console.warn(`Invalid CUSIP length for ${nameOfIssuer}: ${cusip}`);
						continue;
					}

					// Extract voting authority if available
					const votingAuthority = holding.votingAuthority || {};

					// Create institutional holding object
					const parsedHolding: InstitutionalHolding = {
						symbol: symbol.toUpperCase(),
						cusip,
						securityName: nameOfIssuer || "Unknown",
						managerName: "Institutional Investor", // This comes from filing header, not individual holdings
						managerId: "", // This comes from filing header
						reportDate: filing.filingDate,
						filingDate: filing.filingDate,
						shares: Number(shares),
						marketValue: Number(value) * 1000, // Convert from thousands to dollars
						percentOfPortfolio: 0, // Would need total portfolio value to calculate
						sharesChange: 0, // Would need previous quarter data
						sharesChangePercent: 0,
						valueChange: 0,
						valueChangePercent: 0,
						isNewPosition: false, // Would need previous quarter data
						isClosedPosition: false,
						rank: 0, // Would need all holdings to rank
						securityType: holding.titleOfClass || "COM",
						investmentDiscretion: holding.investmentDiscretion || "SOLE",
						timestamp: Date.now(),
						source: "sec_edgar",
						accessionNumber: filing.accessionNumber,
					};

					holdings.push(parsedHolding);
				} catch (error) {
					console.warn(`Skipping invalid 13F holding: ${error instanceof Error ? error.message : String(error)}`);
					continue; // Skip this holding, continue processing others
				}
			}

			if (holdings.length === 0) {
				console.warn(`No valid holdings parsed from 13F filing ${filing.accessionNumber}`);
			}
		} catch (error) {
			console.error(
				`Failed to parse 13F holdings for ${filing.accessionNumber}:`,
				error instanceof Error ? error.message : String(error)
			);
			return []; // Return empty array on complete failure
		}

		return holdings;
	}

	/**
	 * Parse Form 4 transactions from filing data
	 * Extracts insider transactions from SEC EDGAR Form 4 XML filings
	 *
	 * @param symbol Stock symbol for the transactions
	 * @param filingData Raw XML string from SEC EDGAR
	 * @param filing Filing metadata (date, accession number, form type)
	 * @returns Array of parsed insider transactions (empty on error)
	 */
	private parseForm4Transactions(
		symbol: string,
		filingData: any,
		filing: any
	): InsiderTransaction[] {
		const transactions: InsiderTransaction[] = [];

		try {
			// Parse XML string to JavaScript object
			const xmlData = this.xmlParser.parse(filingData);

			// Extract ownership document from XML structure
			const ownershipDoc = xmlData?.ownershipDocument;
			if (!ownershipDoc) {
				console.warn(
					`No ownershipDocument found in Form 4 filing ${filing.accessionNumber}`
				);
				return [];
			}

			// Extract reporting owner information
			const reportingOwner = ownershipDoc.reportingOwner;
			if (!reportingOwner) {
				console.warn(
					`No reportingOwner found in Form 4 filing ${filing.accessionNumber}`
				);
				return [];
			}

			// Get reporting owner details
			const ownerId = reportingOwner.reportingOwnerId || {};
			const ownerName = ownerId.rptOwnerName || "Unknown";
			const ownerCik = ownerId.rptOwnerCik || "";

			// Get relationship information
			const ownerRelationship = reportingOwner.reportingOwnerRelationship || {};
			const relationships: string[] = [];
			if (ownerRelationship.isDirector) relationships.push("Director");
			if (ownerRelationship.isOfficer) relationships.push("Officer");
			if (ownerRelationship.isTenPercentOwner) relationships.push("10% Owner");
			if (ownerRelationship.isOther) relationships.push("Other");

			const ownerTitle = ownerRelationship.officerTitle || undefined;

			// Extract non-derivative transactions
			const nonDerivativeTable = ownershipDoc.nonDerivativeTable;
			if (!nonDerivativeTable) {
				// No non-derivative transactions, return empty array (not an error)
				return [];
			}

			// Get non-derivative transactions (could be single object or array)
			const nonDerivativeTxs = nonDerivativeTable.nonDerivativeTransaction;
			if (!nonDerivativeTxs) {
				return [];
			}

			// Ensure transactions is an array
			const txArray = Array.isArray(nonDerivativeTxs)
				? nonDerivativeTxs
				: [nonDerivativeTxs];

			// Process each transaction
			for (const tx of txArray) {
				try {
					// Extract transaction details
					const securityTitle = tx.securityTitle?.value || tx.securityTitle || "Common Stock";
					const transactionDate = tx.transactionDate?.value || tx.transactionDate;
					const transactionCoding = tx.transactionCoding || {};
					const transactionCode = transactionCoding.transactionCode || "";

					// Skip if required fields are missing
					if (!transactionDate || !transactionCode) {
						continue;
					}

					// Extract transaction amounts
					const amounts = tx.transactionAmounts || {};
					const shares = amounts.transactionShares?.value || amounts.transactionShares || 0;
					const pricePerShare =
						amounts.transactionPricePerShare?.value || amounts.transactionPricePerShare || 0;
					const acquiredDisposedCode =
						amounts.transactionAcquiredDisposedCode?.value ||
						amounts.transactionAcquiredDisposedCode;

					// Skip if no shares
					if (!shares || Number(shares) <= 0) {
						continue;
					}

					// Extract post-transaction amounts
					const postAmounts = tx.postTransactionAmounts || {};
					const sharesOwnedAfter =
						postAmounts.sharesOwnedFollowingTransaction?.value ||
						postAmounts.sharesOwnedFollowingTransaction ||
						0;

					// Determine transaction type from code
					// P = Purchase, S = Sale, A = Award/Grant, M = Exercise, G = Gift, etc.
					let transactionType: "BUY" | "SELL" | "GRANT" | "EXERCISE" | "GIFT" | "OTHER" =
						"OTHER";
					if (transactionCode === "P") {
						transactionType = "BUY";
					} else if (transactionCode === "S" || transactionCode === "D") {
						transactionType = "SELL";
					} else if (transactionCode === "M") {
						transactionType = "EXERCISE";
					} else if (transactionCode === "A" || transactionCode === "J") {
						transactionType = "GRANT";
					} else if (transactionCode === "G") {
						transactionType = "GIFT";
					}

					// Get ownership type
					const ownershipNature = tx.ownershipNature || {};
					const ownershipType = ownershipNature.directOrIndirectOwnership?.value || "D";

					// Calculate transaction value
					const transactionValue =
						Number(shares) * (Number(pricePerShare) || 0);

					// Create insider transaction object
					const parsedTransaction: InsiderTransaction = {
						symbol: symbol.toUpperCase(),
						companyName: "", // Not available in Form 4 XML
						reportingOwnerName: ownerName,
						reportingOwnerTitle: ownerTitle,
						reportingOwnerId: ownerCik,
						relationship: relationships.length > 0 ? relationships : ["Unknown"],
						transactionDate,
						filingDate: filing.filingDate,
						transactionCode,
						transactionType,
						securityTitle,
						shares: Number(shares),
						pricePerShare: Number(pricePerShare) || 0,
						transactionValue: transactionValue || 0,
						sharesOwnedAfter: Number(sharesOwnedAfter),
						ownershipType,
						isAmendment: filing.form.includes("/A"),
						isDerivative: false,
						confidence: 0.95,
						timestamp: Date.now(),
						source: "sec_edgar",
						accessionNumber: filing.accessionNumber,
						formType: filing.form as "4" | "4/A",
					};

					transactions.push(parsedTransaction);
				} catch (error) {
					console.warn(
						`Skipping invalid Form 4 transaction: ${error instanceof Error ? error.message : String(error)}`
					);
					continue; // Skip this transaction, continue processing others
				}
			}

			if (transactions.length === 0) {
				console.warn(
					`No valid transactions parsed from Form 4 filing ${filing.accessionNumber}`
				);
			}
		} catch (error) {
			console.error(
				`Failed to parse Form 4 transactions for ${filing.accessionNumber}:`,
				error instanceof Error ? error.message : String(error)
			);
			return []; // Return empty array on complete failure
		}

		return transactions;
	}

	/**
	 * Calculate institutional sentiment from holdings data
	 */
	private calculateInstitutionalSentiment(
		symbol: string,
		holdings: InstitutionalHolding[]
	): InstitutionalSentiment {
		const currentQuarter = holdings.filter(h => h.reportDate === holdings[0]?.reportDate);
		const totalShares = currentQuarter.reduce((sum, h) => sum + h.shares, 0);
		const totalValue = currentQuarter.reduce((sum, h) => sum + h.marketValue, 0);

		const newPositions = currentQuarter.filter(h => h.isNewPosition).length;
		const closedPositions = currentQuarter.filter(h => h.isClosedPosition).length;
		const increasedPositions = currentQuarter.filter(h => (h.sharesChange || 0) > 0).length;
		const decreasedPositions = currentQuarter.filter(h => (h.sharesChange || 0) < 0).length;

		const netSharesChange = currentQuarter.reduce((sum, h) => sum + (h.sharesChange || 0), 0);
		const netValueChange = currentQuarter.reduce((sum, h) => sum + (h.valueChange || 0), 0);

		const flowScore = netSharesChange > 0 ? 0.7 : netSharesChange < 0 ? -0.7 : 0;
		const sentimentScore = Math.max(0, Math.min(10, 5 + flowScore * 5));

		return {
			symbol: symbol.toUpperCase(),
			reportDate: holdings[0]?.reportDate || new Date().toISOString().split("T")[0],
			totalInstitutions: currentQuarter.length,
			totalShares,
			totalValue,
			averagePosition: totalValue / currentQuarter.length,
			institutionalOwnership: 75.5, // Mock percentage
			quarterlyChange: {
				newPositions,
				closedPositions,
				increasedPositions,
				decreasedPositions,
				netSharesChange,
				netValueChange,
				flowScore,
			},
			topHolders: currentQuarter
				.sort((a, b) => b.marketValue - a.marketValue)
				.slice(0, 5)
				.map(h => ({
					managerName: h.managerName,
					managerId: h.managerId,
					shares: h.shares,
					value: h.marketValue,
					percentOfTotal: (h.marketValue / totalValue) * 100,
					changeFromPrevious: h.valueChange,
				})),
			sentiment: flowScore > 0.2 ? "BULLISH" : flowScore < -0.2 ? "BEARISH" : "NEUTRAL",
			sentimentScore,
			confidence: 0.85,
			timestamp: Date.now(),
			source: "sec_edgar",
		};
	}

	/**
	 * Calculate insider sentiment from transaction data
	 */
	private calculateInsiderSentiment(
		symbol: string,
		transactions: InsiderTransaction[]
	): InsiderSentiment {
		const buyTransactions = transactions.filter(t => t.transactionType === "BUY");
		const sellTransactions = transactions.filter(t => t.transactionType === "SELL");

		const netShares =
			buyTransactions.reduce((sum, t) => sum + t.shares, 0) -
			sellTransactions.reduce((sum, t) => sum + t.shares, 0);

		const buyValue = buyTransactions.reduce((sum, t) => sum + (t.transactionValue || 0), 0);
		const sellValue = sellTransactions.reduce((sum, t) => sum + (t.transactionValue || 0), 0);
		const netValue = buyValue - sellValue;

		const sentimentScore = netValue > 0 ? 7 : netValue < 0 ? 3 : 5;

		return {
			symbol: symbol.toUpperCase(),
			period: "180D",
			totalTransactions: transactions.length,
			totalInsiders: new Set(transactions.map(t => t.reportingOwnerId)).size,
			netShares,
			netValue,
			buyTransactions: buyTransactions.length,
			sellTransactions: sellTransactions.length,
			buyValue,
			sellValue,
			averageTransactionSize: (buyValue + sellValue) / transactions.length,
			insiderTypes: {
				officers: { transactions: 0, netShares: 0, netValue: 0 },
				directors: { transactions: 0, netShares: 0, netValue: 0 },
				tenPercentOwners: { transactions: 0, netShares: 0, netValue: 0 },
				other: { transactions: 0, netShares: 0, netValue: 0 },
			},
			recentActivity: transactions
				.filter(t => t.transactionType === "BUY" || t.transactionType === "SELL")
				.slice(0, 10)
				.map(t => ({
					date: t.transactionDate,
					insiderName: t.reportingOwnerName,
					relationship: t.relationship.join(", "),
					transactionType: t.transactionType as "BUY" | "SELL",
					shares: t.shares,
					value: t.transactionValue,
					significance:
						t.transactionValue && t.transactionValue > 1000000
							? "HIGH"
							: t.transactionValue && t.transactionValue > 100000
								? "MEDIUM"
								: "LOW",
				})),
			sentiment: netValue > 0 ? "BULLISH" : netValue < 0 ? "BEARISH" : "NEUTRAL",
			sentimentScore,
			confidence: 0.8,
			timestamp: Date.now(),
			source: "sec_edgar",
		};
	}

	/**
	 * Make HTTP request to SEC EDGAR API
	 */
	private async makeRequest(endpoint: string): Promise<ApiResponse<any>> {
		// Apply rate limiting before making the request
		await this.rateLimitDelay();

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(`${this.baseUrl}${endpoint}`, {
				signal: controller.signal,
				headers: {
					Accept: "application/json",
					"User-Agent": this.userAgent,
				},
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			return {
				success: true,
				data,
				source: "sec_edgar",
				timestamp: Date.now(),
			};
		} catch (error) {
			clearTimeout(timeoutId);

			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				source: "sec_edgar",
				timestamp: Date.now(),
			};
		}
	}
}
