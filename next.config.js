/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  // Allow cross-origin requests for local development
  allowedDevOrigins: ['veritak.local', 'veritak-api.local']
}

module.exports = nextConfig