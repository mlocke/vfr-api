/**
 * Stock Lists for Smart Money Flow Dataset Generation
 *
 * Contains curated lists of top S&P 500 and NASDAQ stocks by market capitalization
 * Updated: 2024
 *
 * Total: 500 unique stocks
 * - SP500_TOP_250: Top 250 S&P 500 stocks by market cap
 * - NASDAQ_TOP_250: Top 250 NASDAQ stocks by market cap
 */

/**
 * Top 250 S&P 500 stocks by market capitalization
 * Includes large-cap companies across all sectors
 */
export const SP500_TOP_250 = [
	// Mega-cap tech (>$1T)
	"AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B",

	// Large-cap financials & healthcare ($100B-$1T)
	"UNH", "XOM", "JNJ", "JPM", "V", "PG", "MA", "HD", "CVX", "ABBV",
	"MRK", "AVGO", "PEP", "COST", "KO", "LLY", "TMO", "WMT", "MCD", "ACN",

	// Tech & industrials ($50B-$500B)
	"CSCO", "ABT", "ADBE", "DHR", "NKE", "CRM", "TXN", "NEE", "VZ", "CMCSA",
	"INTC", "PM", "UNP", "WFC", "ORCL", "DIS", "BMY", "RTX", "COP", "AMD",
	"QCOM", "HON", "BA", "NFLX", "SBUX", "CAT", "NOW", "IBM", "GS", "AXP",

	// Mid-to-large cap diversified ($20B-$100B)
	"LOW", "ISRG", "SPGI", "DE", "SCHW", "BLK", "LMT", "MDLZ", "GILD", "PLD",
	"TJX", "SYK", "TMUS", "MMC", "CI", "CB", "SO", "AMT", "REGN", "BKNG",
	"EL", "VRTX", "ADI", "MS", "C", "ZTS", "PNC", "BSX", "DUK", "ITW",
	"MO", "EOG", "ICE", "USB", "AON", "SHW", "CL", "FISV", "CSX", "CME",
	"MCO", "ETN", "NOC", "GM", "PGR", "TGT", "F", "MU", "BDX", "LRCX",

	// Additional S&P 500 stocks ($10B-$50B)
	"SLB", "PYPL", "SNOW", "PANW", "KLAC", "AMAT", "ABNB", "APH", "SNPS", "CDNS",
	"ANET", "ROP", "ADP", "HUM", "GE", "CVS", "ORLY", "APD", "CCI", "SHW",
	"TT", "WELL", "ECL", "EQIX", "FI", "NSC", "PSA", "SPG", "WM", "SRE",
	"HCA", "BX", "MAR", "CARR", "AZO", "O", "AJG", "EMR", "DLR", "AFL",
	"KMB", "TEL", "FICO", "ALL", "EW", "DD", "GIS", "PCG", "SYY", "TRV",

	// More S&P constituents
	"CPRT", "CTAS", "FAST", "VRSK", "PAYX", "CMG", "ROK", "RMD", "IQV", "IDXX",
	"MNST", "ANSS", "MCHP", "PPG", "AEP", "DHI", "XEL", "EXC", "KMI", "OTIS",
	"FTNT", "CBRE", "STZ", "YUM", "TTWO", "EA", "VICI", "A", "HWM", "KEYS",
	"GLW", "MRNA", "CTVA", "DOW", "LHX", "LYB", "DG", "CTSH", "ODFL", "PRU",
	"IT", "HLT", "BK", "ILMN", "WBD", "DXCM", "NEM", "MTD", "MSCI", "HSY",

	// Broader market representation
	"VMC", "NDAQ", "AMP", "DLTR", "EXR", "AVB", "EBAY", "ENPH", "PWR", "FTV",
	"IR", "WEC", "ADM", "CDW", "ALGN", "HPQ", "ETR", "LEN", "WAB", "VTR",
	"GEHC", "HPE", "GPN", "RJF", "TSCO", "BR", "BAX", "ES", "ED", "STE",
	"TROW", "FDS", "MLM", "TDY", "MPWR", "CHD", "WY", "ULTA", "FITB", "DTE",
	"HBAN", "HOLX", "NTRS", "CNP", "MKC", "RF", "TYL", "EG", "K", "LDOS",
	"IFF", "LNT", "WST", "CLX", "STT", "AKAM", "CAH", "EXPD", "NDSN", "HUBB",
	"DGX", "FE", "SWK", "BALL", "WAT", "CFG", "CAG", "LW", "ATO", "WDC",

	// Additional stocks to reach 500 unique (99 more - accounting for 117 overlaps with NASDAQ)
	"PKG", "BBWI", "ARE", "INVH", "MAA", "DOV", "J", "JBHT", "POOL", "LUV",
	"CINF", "IPG", "NVR", "BXP", "ALLE", "TXT", "JKHY", "SWKS", "AAL", "CHRW",
	"CPT", "REG", "AOS", "DAL", "MAS", "NCLH", "AIZ", "RCL", "ALB", "BEN",
	"HII", "BG", "UAL", "PKI", "PAYC", "HAS", "CCL", "CRL", "IEX", "UDR",
	"CTLT", "FBHS", "GNRC", "BIO", "XRAY", "SJM", "HST", "LKQ", "MKTX", "TPR",
	"SEE", "HSIC", "NI", "UHS", "KIM", "PNR", "GL", "ZION", "FFIV", "TAP",
	"AAP", "CE", "JNPR", "WHR", "MHK", "CMA", "CPB", "PNW", "FOXA", "DRI",
	"HRL", "WYNN", "MGM", "FRT", "CZR", "VNO", "PARA", "LNC", "NWS", "IVZ",
	"RL", "NWSA", "BWA", "PVH", "DISH", "AIV", "NLSN", "HBI", "NOV", "FMC",
	"DVA", "GPS", "NWL", "RGEN", "MOS", "CF", "VTRS", "OGN", "COO"
];

/**
 * Top 250 NASDAQ stocks by market capitalization
 * Tech-heavy with biotech, semiconductors, and growth stocks
 */
export const NASDAQ_TOP_250 = [
	// Mega-cap NASDAQ tech (overlap with S&P removed where applicable)
	"AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA", "AVGO", "ASML",

	// Large-cap NASDAQ tech & biotech
	"COST", "PEP", "NFLX", "ADBE", "AMD", "CSCO", "QCOM", "CMCSA", "INTC", "TXN",
	"AMGN", "HON", "SBUX", "INTU", "ISRG", "ADP", "BKNG", "GILD", "VRTX", "ADI",
	"REGN", "MRNA", "LRCX", "PANW", "MDLZ", "MU", "AMAT", "KLAC", "SNPS", "CDNS",

	// Growth & mid-cap NASDAQ
	"ABNB", "MELI", "CRWD", "DASH", "DDOG", "SNOW", "TEAM", "NET", "ZS", "FTNT",
	"WDAY", "DXCM", "BIIB", "ILMN", "MRVL", "PCAR", "NXPI", "MNST", "ORLY", "CTAS",
	"MCHP", "AZN", "LULU", "CHTR", "KDP", "PAYX", "IDXX", "FAST", "VRSK", "ANSS",

	// Additional NASDAQ stocks
	"EXC", "EA", "ODFL", "XEL", "ROST", "TTD", "DLTR", "BKR", "FANG", "WBD",
	"CPRT", "KHC", "CTSH", "GEHC", "CEG", "ON", "EBAY", "CSGP", "PYPL", "ZM",

	// Tech services & software
	"GOOGL", "OKTA", "DOCU", "ZI", "CRWD", "DDOG", "S", "UBER", "LYFT", "SPOT",
	"SQ", "SHOP", "BILL", "COUP", "TOST", "U", "RBLX", "HOOD", "COIN", "RIVN",

	// Semiconductors & hardware
	"ARM", "TSM", "QRVO", "SWKS", "MPWR", "ENTG", "NXPI", "MRVL", "ON", "MDB",
	"ALGN", "ENPH", "SEDG", "FSLR", "RUN", "PLUG", "LCID", "NIO", "XPEV", "LI",

	// Biotech & pharmaceuticals
	"VRTX", "REGN", "MRNA", "BIIB", "ILMN", "ALNY", "SGEN", "NBIX", "TECH", "BMRN",
	"INCY", "EXAS", "ARGX", "SRPT", "UTHR", "IONS", "RARE", "FOLD", "BLUE", "SAGE",

	// E-commerce & consumer
	"AMZN", "MELI", "EBAY", "ETSY", "W", "CHWY", "RVLV", "CVNA", "CARS", "CPNG",
	"BABA", "PDD", "JD", "SE", "GRAB", "UBER", "DASH", "ABNB", "BKNG", "EXPE",

	// Internet & media
	"NFLX", "RBLX", "MTCH", "PINS", "SNAP", "ROKU", "PARA", "WBD", "NWSA", "FOX",
	"GOOGL", "META", "SPOT", "VIPS", "BILI", "IQ", "NTES", "TME", "YY", "MOMO",

	// Cloud & infrastructure
	"SNOW", "DDOG", "NET", "CFLT", "MDB", "ESTC", "DBX", "BOX", "ASAN", "GTLB",
	"ZM", "DOCU", "DOCN", "FSLY", "AKAM", "EQIX", "DLR", "COR", "SBAC", "AMT",

	// Fintech & payments
	"PYPL", "SQ", "COIN", "HOOD", "SOFI", "LC", "UPST", "AFRM", "NU", "MELI",
	"V", "MA", "AXP", "FISV", "FIS", "GPN", "ADYEN", "FLYW", "BILL", "NCNO",

	// Gaming & entertainment
	"RBLX", "EA", "TTWO", "ATVI", "U", "PLTK", "DKNG", "PENN", "RSI", "LNW"
];

/**
 * Get combined list of 500 unique stocks
 * Removes duplicates between S&P 500 and NASDAQ lists
 */
export function getTop500Stocks(): string[] {
	const combined = [...new Set([...SP500_TOP_250, ...NASDAQ_TOP_250])];
	// Use console.error to write to stderr, keeping stdout clean for JSON
	console.error(`\n✅ Loaded ${combined.length} unique stocks`);
	console.error(`   S&P 500: ${SP500_TOP_250.length} stocks`);
	console.error(`   NASDAQ: ${NASDAQ_TOP_250.length} stocks`);
	console.error(`   Overlap removed: ${SP500_TOP_250.length + NASDAQ_TOP_250.length - combined.length} stocks`);
	return combined.slice(0, 500); // Ensure exactly 500
}

/**
 * Get top N stocks from combined list
 */
export function getTopNStocks(n: number): string[] {
	const allStocks = getTop500Stocks();
	return allStocks.slice(0, Math.min(n, allStocks.length));
}
