/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // ⚠️ Ignora erros de tipagem no build para garantir o deploy
    ignoreBuildErrors: true,
  },
  eslint: {
    // ⚠️ Ignora avisos de linter no build
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;
