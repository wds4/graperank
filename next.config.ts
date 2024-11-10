import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 
  config options here 
  This file is protected from update by github using gitignore
  so that env vars can be set locally
  */
  env: {
    AWS_REGION: 'us-east-1'
  }
};

export default nextConfig;
