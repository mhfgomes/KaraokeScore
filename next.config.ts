import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build mínimo (server.js + dependências necessárias) para a imagem Docker
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
