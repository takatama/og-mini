#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const API_KEYS_FILE = path.join(__dirname, "..", "api-keys.json");

// Load existing API keys
function loadApiKeys() {
  if (!fs.existsSync(API_KEYS_FILE)) {
    return {};
  }
  try {
    const content = fs.readFileSync(API_KEYS_FILE, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error("❌ Failed to load API keys:", error.message);
    return {};
  }
}

// Save API keys
function saveApiKeys(apiKeys) {
  try {
    fs.writeFileSync(API_KEYS_FILE, JSON.stringify(apiKeys, null, 2));
    return true;
  } catch (error) {
    console.error("❌ Failed to save API keys:", error.message);
    return false;
  }
}

// Generate a new API key
function generateApiKey() {
  return crypto.randomBytes(32).toString("hex");
}

// Add a new API key
function addApiKey(name, customKey = null) {
  const apiKeys = loadApiKeys();

  if (apiKeys[name]) {
    console.error(`❌ API key with name "${name}" already exists`);
    return false;
  }

  const key = customKey || generateApiKey();
  apiKeys[name] = {
    key,
    createdAt: new Date().toISOString(),
  };

  if (saveApiKeys(apiKeys)) {
    console.log(`✅ API key "${name}" added successfully`);
    console.log(`🔑 Key: ${key}`);
    return true;
  }
  return false;
}

// List all API keys
function listApiKeys() {
  const apiKeys = loadApiKeys();
  const names = Object.keys(apiKeys);

  if (names.length === 0) {
    console.log("📝 No API keys found");
    return;
  }

  console.log("📋 API Keys:");
  console.log("=".repeat(50));
  names.forEach((name) => {
    const data = apiKeys[name];
    console.log(`Name: ${name}`);
    console.log(`Key: ${data.key}`);
    console.log(`Created: ${data.createdAt}`);
    console.log("-".repeat(30));
  });
}

// Remove an API key
function removeApiKey(name) {
  const apiKeys = loadApiKeys();

  if (!apiKeys[name]) {
    console.error(`❌ API key with name "${name}" not found`);
    return false;
  }

  delete apiKeys[name];

  if (saveApiKeys(apiKeys)) {
    console.log(`✅ API key "${name}" removed successfully`);
    return true;
  }
  return false;
}

// Get all valid keys (for environment variable)
function getValidKeysString() {
  const apiKeys = loadApiKeys();
  const keys = Object.values(apiKeys).map((data) => data.key);
  return keys.join(",");
}

// Update .env file with current API keys
function updateEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  const validKeys = getValidKeysString();

  if (!fs.existsSync(envPath)) {
    console.error("❌ .env file not found");
    return false;
  }

  try {
    let envContent = fs.readFileSync(envPath, "utf8");
    const lines = envContent.split("\n");
    let found = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("API_KEYS=")) {
        lines[i] = `API_KEYS=${validKeys}`;
        found = true;
        break;
      }
    }

    if (!found) {
      lines.push(`API_KEYS=${validKeys}`);
    }

    fs.writeFileSync(envPath, lines.join("\n"));
    console.log("✅ .env file updated with current API keys");
    return true;
  } catch (error) {
    console.error("❌ Failed to update .env file:", error.message);
    return false;
  }
}

// Main CLI
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "add":
      const name = args[1];
      const customKey = args[2];
      if (!name) {
        console.error("❌ Please provide a name for the API key");
        console.log("Usage: npm run api-key:add <name> [custom-key]");
        process.exit(1);
      }
      addApiKey(name, customKey);
      updateEnvFile();
      break;

    case "list":
      listApiKeys();
      break;

    case "remove":
      const removeName = args[1];
      if (!removeName) {
        console.error("❌ Please provide the name of the API key to remove");
        console.log("Usage: npm run api-key:remove <name>");
        process.exit(1);
      }
      removeApiKey(removeName);
      updateEnvFile();
      break;

    case "update-env":
      updateEnvFile();
      break;

    default:
      console.log("🔑 API Key Management");
      console.log("");
      console.log("Commands:");
      console.log("  add <name> [key]  - Add a new API key with name");
      console.log("  list              - List all API keys");
      console.log("  remove <name>     - Remove an API key by name");
      console.log("  update-env        - Update .env file with current keys");
      console.log("");
      console.log("Examples:");
      console.log("  npm run api-key:add myapp");
      console.log("  npm run api-key:add myapp custom-key-here");
      console.log("  npm run api-key:list");
      console.log("  npm run api-key:remove myapp");
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  loadApiKeys,
  saveApiKeys,
  generateApiKey,
  addApiKey,
  listApiKeys,
  removeApiKey,
  getValidKeysString,
  updateEnvFile,
};
