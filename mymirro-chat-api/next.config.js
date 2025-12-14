/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server Actions are enabled by default in Next.js 14
  eslint: {
    // Disable ESLint during builds (optional - can enable later if needed)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ensure TypeScript errors fail the build
    ignoreBuildErrors: false,
  },
  // Enable standalone output for Docker
  output: 'standalone',
};

module.exports = nextConfig;

