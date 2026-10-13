import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O pacote de protocolo é TypeScript cru dentro do monorepo.
  transpilePackages: ["@telovis/protocol"],
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
