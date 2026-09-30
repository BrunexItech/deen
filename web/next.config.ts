import type { NextConfig } from "next";

// The browser only ever talks to this origin: /api is proxied to the FastAPI backend,
// so auth cookies stay first-party (httpOnly, SameSite) and no CORS is involved.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:8020";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
