/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Configure for @napi-rs/canvas compatibility
    config.externals = config.externals || [];
    config.externals.push({
      '@napi-rs/canvas': '@napi-rs/canvas',
    });
    return config;
  },
}

module.exports = nextConfig 