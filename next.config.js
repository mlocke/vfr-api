/** @type {import('next').NextConfig} */
const nextConfig = {
	typedRoutes: true,
	// Allow cross-origin requests for local development
	allowedDevOrigins: ["veritak.local", "veritak-api.local"],
	// Explicitly set the workspace root to avoid Next.js inference issues
	outputFileTracingRoot: __dirname,
};

module.exports = nextConfig;
