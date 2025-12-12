#!/usr/bin/env node
/**
 * Updates version number and build timestamp before each build
 * Updates both src/version.ts and atlassian-connect.json
 */

const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '..', 'src', 'version.ts');
const connectFile = path.join(__dirname, '..', 'atlassian-connect.json');

// Read current version or start at 0.0.0
let major = 0, minor = 0, patch = 0;

if (fs.existsSync(versionFile)) {
  const content = fs.readFileSync(versionFile, 'utf8');
  const match = content.match(/VERSION\s*=\s*['"](\d+)\.(\d+)\.(\d+)['"]/);
  if (match) {
    major = parseInt(match[1], 10);
    minor = parseInt(match[2], 10);
    patch = parseInt(match[3], 10);
    patch++; // Increment patch version
  }
}

const version = `${major}.${minor}.${patch}`;
const buildDate = new Date().toISOString();

// Update src/version.ts
const versionContent = `// Auto-generated - do not edit manually
export const VERSION = '${version}';
export const BUILD_DATE = '${buildDate}';
export const BUILD_INFO = \`Excaliframe v\${VERSION} (built \${BUILD_DATE})\`;
`;

fs.writeFileSync(versionFile, versionContent);
console.log(`Updated src/version.ts to ${version} (${buildDate})`);

// Update atlassian-connect.json
if (fs.existsSync(connectFile)) {
  const connectContent = fs.readFileSync(connectFile, 'utf8');
  const connectJson = JSON.parse(connectContent);
  connectJson.version = version;
  fs.writeFileSync(connectFile, JSON.stringify(connectJson, null, 2) + '\n');
  console.log(`Updated atlassian-connect.json version to ${version}`);
}
