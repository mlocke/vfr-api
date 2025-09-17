/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  // Allow cross-origin requests for local development
  allowedDevOrigins: ['veritak.local']
}

module.exports = nextConfig