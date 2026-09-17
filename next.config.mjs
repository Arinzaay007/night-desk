/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The e2b live-preview proxy loads the dev server from a different origin.
  // Without this, Next 15 blocks cross-origin dev asset/HMR requests.
  allowedDevOrigins: ['*.e2b.app', '*.e2b.dev', 'localhost', '127.0.0.1'],
};

export default nextConfig;
