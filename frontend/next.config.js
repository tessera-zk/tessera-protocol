/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  webpack: (config, { isServer, webpack }) => {
    // snarkjs / circomlibjs reference Node builtins that don't exist in the
    // browser. Client-side proving only needs the WASM + fetch paths, so stub
    // the rest out rather than polyfilling.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      crypto: false,
      stream: false,
      constants: false,
      readline: false,
      worker_threads: false,
    };
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
    };
    if (!isServer) {
      // The Stellar SDK expects a global Buffer in the browser.
      config.plugins.push(
        new webpack.ProvidePlugin({ Buffer: ["buffer", "Buffer"] }),
      );
    }
    return config;
  },
};

module.exports = nextConfig;
