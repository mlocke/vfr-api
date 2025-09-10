/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
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