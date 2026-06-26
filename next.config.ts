import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This project lives under ~/Desktop, which macOS iCloud Drive syncs. iCloud
  // races the build and snatches/duplicates files inside `.next` (causing ENOENT
  // on temp manifest files). macOS excludes any path ending in `.nosync` from
  // iCloud, so we point the build output there to stop the corruption.
  // Harmless on non-iCloud machines — it's just the build directory name.
  distDir: ".next.nosync",
};

export default nextConfig;
