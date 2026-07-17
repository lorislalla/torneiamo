import type { NextConfig } from "next";

const appVersion =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.npm_package_version ??
  "0.1.0";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;
