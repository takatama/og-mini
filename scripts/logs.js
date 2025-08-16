#!/usr/bin/env node

const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");

  if (!fs.existsSync(envPath)) {
    console.error("❌ .env file not found");
    console.log("📝 Please copy .env.example to .env and configure it");
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const env = {};

  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^#][^=]*?)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      env[key.trim()] = value.trim().replace(/^["']|["']$/g, "");
    }
  });

  return env;
}

const config = loadEnv();

// Validate required configuration
if (!config.PROJECT_ID || config.PROJECT_ID === "your-project-id") {
  console.error("❌ Please set PROJECT_ID in .env file");
  process.exit(1);
}

if (!config.REGION) {
  console.error("❌ Please set REGION in .env file");
  process.exit(1);
}

if (!config.FUNCTION_NAME) {
  console.error("❌ Please set FUNCTION_NAME in .env file");
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const isStream = args.includes("--stream") || args.includes("-s");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? limitArg.split("=")[1] : "100";

console.log(`📋 Viewing logs for: ${config.FUNCTION_NAME}`);
console.log(`📦 Project: ${config.PROJECT_ID}`);
console.log(`🌏 Region: ${config.REGION}`);

if (isStream) {
  console.log("🔄 Streaming logs (Press Ctrl+C to stop)...");
} else {
  console.log(`📄 Showing last ${limit} log entries...`);
}
console.log("");

// Build gcloud logs command
let cmd;
if (isStream) {
  cmd = `gcloud functions logs tail ${config.FUNCTION_NAME} --gen2 --region=${config.REGION}`;
} else {
  cmd = `gcloud functions logs read ${config.FUNCTION_NAME} --gen2 --region=${config.REGION} --limit=${limit}`;
}

// Add project if specified
if (config.PROJECT_ID && config.PROJECT_ID !== "your-project-id") {
  cmd += ` --project=${config.PROJECT_ID}`;
}

try {
  console.log(`💻 Command: ${cmd}`);
  console.log("");
  execSync(cmd, { stdio: "inherit" });
} catch (error) {
  console.error("❌ Failed to retrieve logs:", error.message);
  process.exit(1);
}
