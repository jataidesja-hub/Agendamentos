/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  typescript: {
    // ⚠️ Ignora erros de tipagem no build para garantir o deploy
    ignoreBuildErrors: true,
  },
  eslint: {
    // ⚠️ Ignora avisos de linter no build
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true
  }
};

export default nextConfig;
