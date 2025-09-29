/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Prevent pdfjs-dist from attempting to require 'canvas' on server builds
    // which causes a native dependency error. Instead, make it resolve to false.
    if (config.resolve) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        canvas: false
      };
    }

    return config;
  }
};

module.exports = nextConfig;
