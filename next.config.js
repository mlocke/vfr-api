/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  // Allow cross-origin requests for local development
  allowedDevOrigins: ['veritak.local'],
  // Force port 3000
  async rewrites() {
    return []
  },
  // Custom server configuration
  async headers() {
    return []
  }
}

module.exports = nextConfig