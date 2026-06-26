import type { NextConfig } from "next";

// Locally this project lives under ~/Desktop, which macOS iCloud Drive syncs.
// iCloud races the build and corrupts files inside `.next` (ENOENT on temp
// manifest files). macOS excludes any path ending in `.nosync` from iCloud, so
// locally we write the build output there.
//
// In CI / on Netlify there is no iCloud, and the @netlify/plugin-nextjs expects
// the standard `.next` directory — so use the default output dir there.
const isCI = process.env.CI === "true" || process.env.NETLIFY === "true";

const nextConfig: NextConfig = {
  distDir: isCI ? ".next" : ".next.nosync",
};

export default nextConfig;
