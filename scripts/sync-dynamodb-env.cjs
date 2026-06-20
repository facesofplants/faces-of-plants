// Script to sync DynamoDB table name from SST outputs to .env.local for Next.js
const fs = require('fs');
const path = require('path');

const outputsPath = path.resolve(__dirname, '../.sst/outputs.json');
const envPath = path.resolve(__dirname, '../packages/web/.env.local');

if (!fs.existsSync(outputsPath)) {
  console.error('No .sst/outputs.json found. Run SST deploy first.');
  process.exit(1);
}

const outputs = JSON.parse(fs.readFileSync(outputsPath, 'utf-8'));
const tableName = outputs.DATA_SOURCES_TABLE;
if (!tableName) {
  console.error('DATA_SOURCES_TABLE not found in SST outputs.');
  process.exit(1);
}

let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
  envContent = envContent.replace(/^DATA_SOURCES_TABLE=.*$/m, '');
}

envContent += `\nDATA_SOURCES_TABLE=${tableName}\n`;
fs.writeFileSync(envPath, envContent.trim() + '\n');
console.log(`Synced DATA_SOURCES_TABLE to .env.local: ${tableName}`);
