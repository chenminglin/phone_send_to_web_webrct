import type { NextConfig } from "next";
import fs from 'fs';
import path from 'path';

const isDev = process.env.NODE_ENV === 'development';


const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
};

if (isDev) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

module.exports = nextConfig;

export default nextConfig;
