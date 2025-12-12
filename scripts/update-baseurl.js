#!/usr/bin/env node

/**
 * Helper script to update baseUrl in atlassian-connect.json
 * Usage: node scripts/update-baseurl.js <new-url>
 * Example: node scripts/update-baseurl.js https://abc123.ngrok.io
 */

const fs = require('fs');
const path = require('path');

const newUrl = process.argv[2];

if (!newUrl) {
  console.error('Usage: node scripts/update-baseurl.js <new-url>');
  console.error('Example: node scripts/update-baseurl.js https://abc123.ngrok.io');
  process.exit(1);
}

const configPath = path.join(__dirname, '..', 'atlassian-connect.json');

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const oldUrl = config.baseUrl;
  config.baseUrl = newUrl;
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  
  console.log(`✓ Updated baseUrl:`);
  console.log(`  Old: ${oldUrl}`);
  console.log(`  New: ${newUrl}`);
  console.log(`\nNow install the app in Confluence using:`);
  console.log(`  ${newUrl}/confluence/atlassian-connect.json`);
} catch (error) {
  console.error('Error updating baseUrl:', error.message);
  process.exit(1);
}
