import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Required for Docker — generates .next/standalone/server.js
};

export default nextConfig;
