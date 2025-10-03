/**
 * Performance Test Setup
 * Global setup and configuration for performance tests
 */

// Enable garbage collection for memory leak detection
if (typeof global.gc === "function") {
	console.log("✅ Garbage collection enabled for performance tests");
} else {
	console.warn("⚠️ Garbage collection not available - memory leak tests may be limited");
}

// Performance test environment variables
process.env.NODE_ENV = "test";
process.env.PERFORMANCE_TEST_MODE = "true";

// Suppress non-critical warnings during performance testing
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
	const message = args.join(" ");

	// Suppress specific warnings that don't affect performance testing
	const suppressPatterns = [
		"deprecated",
		"ExperimentalWarning",
		"DeprecationWarning",
		"punycode",
	];

	if (!suppressPatterns.some(pattern => message.includes(pattern))) {
		originalConsoleWarn(...args);
	}
};

// Global performance test configuration
global.PERFORMANCE_CONFIG = {
	TARGET_RESPONSE_TIME_MS: 500,
	MEMORY_LEAK_THRESHOLD_MB: 50,
	CACHE_HIT_RATE_TARGET: 0.8,
	TEST_SYMBOLS: ["AAPL", "MSFT", "GOOGL", "TSLA"],
	API_TIMEOUT_MS: 10000,
};

// Performance monitoring utilities
global.performanceUtils = {
	startTime: null,
	memoryBefore: null,

	startMonitoring() {
		this.startTime = Date.now();
		this.memoryBefore = process.memoryUsage();
		return { startTime: this.startTime, memoryBefore: this.memoryBefore };
	},

	endMonitoring() {
		const endTime = Date.now();
		const memoryAfter = process.memoryUsage();

		return {
			duration: endTime - (this.startTime || endTime),
			memoryDelta: {
				rss: memoryAfter.rss - (this.memoryBefore?.rss || 0),
				heapUsed: memoryAfter.heapUsed - (this.memoryBefore?.heapUsed || 0),
				heapTotal: memoryAfter.heapTotal - (this.memoryBefore?.heapTotal || 0),
				external: memoryAfter.external - (this.memoryBefore?.external || 0),
			},
		};
	},
};

// Setup periodic garbage collection for memory tests
let gcInterval;
if (global.gc) {
	gcInterval = setInterval(() => {
		if (process.env.PERFORMANCE_GC_ENABLED === "true") {
			global.gc();
		}
	}, 30000); // Every 30 seconds
}

// Cleanup function
global.performanceCleanup = () => {
	if (gcInterval) {
		clearInterval(gcInterval);
	}

	if (global.gc) {
		global.gc();
	}
};

// Enhanced test timeout handling
const originalSetTimeout = global.setTimeout;
global.setTimeout = (fn, delay, ...args) => {
	// Reduce timeout delays during performance testing
	const adjustedDelay =
		process.env.PERFORMANCE_TEST_MODE === "true" ? Math.min(delay, 1000) : delay;

	return originalSetTimeout(fn, adjustedDelay, ...args);
};

// Memory monitoring hook
beforeEach(() => {
	if (global.gc && process.env.PERFORMANCE_GC_BEFORE_EACH === "true") {
		global.gc();
	}
});

afterEach(() => {
	if (global.gc && process.env.PERFORMANCE_GC_AFTER_EACH === "true") {
		global.gc();
	}
});

// Global cleanup on exit
process.on("exit", () => {
	if (global.performanceCleanup) {
		global.performanceCleanup();
	}
});

console.log("🚀 Performance test environment initialized");
console.log(`📊 Target response time: ${global.PERFORMANCE_CONFIG.TARGET_RESPONSE_TIME_MS}ms`);
console.log(`🧠 Memory leak threshold: ${global.PERFORMANCE_CONFIG.MEMORY_LEAK_THRESHOLD_MB}MB`);
console.log(
	`🎯 Cache hit rate target: ${Math.round(global.PERFORMANCE_CONFIG.CACHE_HIT_RATE_TARGET * 100)}%`
);
