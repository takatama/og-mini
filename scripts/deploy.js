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

console.log("🚀 Starting deployment...");
console.log(`📦 Project: ${config.PROJECT_ID}`);
console.log(`🌏 Region: ${config.REGION}`);
console.log(`⚡ Function: ${config.FUNCTION_NAME}`);
console.log("");

// Build gcloud command
const cmd = [
  "gcloud functions deploy",
  config.FUNCTION_NAME,
  "--gen2",
  `--runtime=${config.RUNTIME || "nodejs20"}`,
  `--region=${config.REGION}`,
  "--entry-point=og",
  "--trigger-http",
  "--allow-unauthenticated",
  `--memory=${config.MEMORY || "256MB"}`,
  `--timeout=${config.TIMEOUT || "8s"}`,
];

// Add service account if specified
if (config.SERVICE_ACCOUNT) {
  cmd.push(`--service-account=${config.SERVICE_ACCOUNT}`);
} else if (config.PROJECT_ID && config.PROJECT_ID !== "your-project-id") {
  // Auto-generate service account name based on project
  cmd.push(
    `--service-account=og-mini-sa@${config.PROJECT_ID}.iam.gserviceaccount.com`
  );
}

// Add project if specified
if (config.PROJECT_ID && config.PROJECT_ID !== "your-project-id") {
  cmd.push(`--project=${config.PROJECT_ID}`);
}

const command = cmd.join(" ");

try {
  console.log(`💻 Command: ${command}`);
  console.log("");
  execSync(command, { stdio: "inherit" });
  console.log("");
  console.log("✅ Deployment completed successfully!");
  console.log(
    `🔗 URL: https://${config.REGION}-${config.PROJECT_ID}.cloudfunctions.net/${config.FUNCTION_NAME}`
  );
} catch (error) {
  console.error("❌ Deployment failed:", error.message);
  process.exit(1);
}
