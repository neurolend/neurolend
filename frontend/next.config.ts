import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: config => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    
    // Resolve preact modules for @coinbase/wallet-sdk
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'preact': require.resolve('preact'),
      'preact/hooks': require.resolve('preact/hooks')
    }
    
    // Also add alias for preact/hooks
    config.resolve.alias = {
      ...config.resolve.alias,
      'preact/hooks': require.resolve('preact/hooks')
    }
    
    return config
  }
};

export default nextConfig;
