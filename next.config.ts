import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The local embedding model uses native/ONNX code that must not be bundled.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
};

export default nextConfig;
