#!/usr/bin/env node

/**
 * Validate atlassian-connect.json against Confluence Connect schema
 */

const fs = require('fs');
const path = require('path');

// Read the JSON file
const jsonPath = path.join(__dirname, '..', 'atlassian-connect.json');
let jsonContent;

try {
  jsonContent = fs.readFileSync(jsonPath, 'utf8');
} catch (error) {
  console.error('❌ Error reading atlassian-connect.json:', error.message);
  process.exit(1);
}

// Parse JSON
let descriptor;
try {
  descriptor = JSON.parse(jsonContent);
} catch (error) {
  console.error('❌ Invalid JSON:', error.message);
  process.exit(1);
}

console.log('🔍 Validating atlassian-connect.json...\n');

const errors = [];
const warnings = [];

// Required fields
const requiredFields = {
  key: 'string',
  name: 'string',
  baseUrl: 'string',
  version: 'string',
  apiVersion: 'number',
  authentication: 'object',
  scopes: 'array',
  modules: 'object'
};

// Validate required fields
for (const [field, expectedType] of Object.entries(requiredFields)) {
  if (!(field in descriptor)) {
    errors.push(`Missing required field: ${field}`);
  } else {
    const actualType = Array.isArray(descriptor[field]) ? 'array' : typeof descriptor[field];
    if (actualType !== expectedType) {
      errors.push(`Field '${field}' should be ${expectedType}, got ${actualType}`);
    }
  }
}

// Validate key format (should be reverse domain notation)
if (descriptor.key && !/^[a-z0-9]+\.[a-z0-9]+(\.[a-z0-9-]+)*$/.test(descriptor.key)) {
  errors.push(`Invalid key format: '${descriptor.key}'. Should be reverse domain notation (e.g., com.example.plugin)`);
}

// Validate baseUrl
if (descriptor.baseUrl) {
  try {
    const url = new URL(descriptor.baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      errors.push(`baseUrl must use http:// or https:// protocol`);
    }
  } catch (e) {
    errors.push(`Invalid baseUrl format: ${descriptor.baseUrl}`);
  }
}

// Validate version format (should be semantic version)
if (descriptor.version && !/^\d+\.\d+\.\d+/.test(descriptor.version)) {
  warnings.push(`Version '${descriptor.version}' should follow semantic versioning (e.g., 1.0.0)`);
}

// Validate apiVersion (should be 1 for Confluence)
if (descriptor.apiVersion !== undefined && descriptor.apiVersion !== 1) {
  warnings.push(`apiVersion should be 1 for Confluence Connect`);
}

// Validate authentication
if (descriptor.authentication) {
  if (!descriptor.authentication.type) {
    errors.push('authentication.type is required');
  } else if (!['none', 'jwt', 'basic'].includes(descriptor.authentication.type)) {
    warnings.push(`authentication.type '${descriptor.authentication.type}' may not be supported`);
  }
}

// Validate scopes
if (descriptor.scopes) {
  const validScopes = ['read', 'write', 'delete', 'admin'];
  for (const scope of descriptor.scopes) {
    if (!validScopes.includes(scope)) {
      warnings.push(`Unknown scope: '${scope}'. Valid scopes: ${validScopes.join(', ')}`);
    }
  }
  if (descriptor.scopes.length === 0) {
    warnings.push('scopes array is empty. At least one scope is recommended');
  }
}

// Validate lifecycle endpoints
if (descriptor.lifecycle) {
  if (descriptor.lifecycle.installed && !descriptor.lifecycle.installed.startsWith('/')) {
    errors.push('lifecycle.installed must start with /');
  }
  if (descriptor.lifecycle.uninstalled && !descriptor.lifecycle.uninstalled.startsWith('/')) {
    errors.push('lifecycle.uninstalled must start with /');
  }
}

// Validate customContent modules
if (descriptor.modules && descriptor.modules.customContent) {
  if (!Array.isArray(descriptor.modules.customContent)) {
    errors.push('modules.customContent must be an array');
  } else {
    descriptor.modules.customContent.forEach((module, index) => {
      if (!module.key) {
        errors.push(`modules.customContent[${index}].key is required`);
      }
      if (!module.name || !module.name.value) {
        errors.push(`modules.customContent[${index}].name.value is required`);
      }
      if (!module.editor || !module.editor.url) {
        errors.push(`modules.customContent[${index}].editor.url is required`);
      } else if (!module.editor.url.startsWith('/')) {
        errors.push(`modules.customContent[${index}].editor.url must start with /`);
      }
      if (!module.renderer || !module.renderer.url) {
        errors.push(`modules.customContent[${index}].renderer.url is required`);
      } else if (!module.renderer.url.startsWith('/')) {
        errors.push(`modules.customContent[${index}].renderer.url must start with /`);
      }
      if (module.icon) {
        if (!module.icon.url) {
          errors.push(`modules.customContent[${index}].icon.url is required if icon is specified`);
        } else if (!module.icon.url.startsWith('/')) {
          errors.push(`modules.customContent[${index}].icon.url must start with /`);
        }
        if (module.icon.width && typeof module.icon.width !== 'number') {
          errors.push(`modules.customContent[${index}].icon.width must be a number`);
        }
        if (module.icon.height && typeof module.icon.height !== 'number') {
          errors.push(`modules.customContent[${index}].icon.height must be a number`);
        }
      }
    });
  }
}

// Print results
if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ atlassian-connect.json is valid!\n');
  console.log('📋 Summary:');
  console.log(`   Key: ${descriptor.key}`);
  console.log(`   Name: ${descriptor.name}`);
  console.log(`   Base URL: ${descriptor.baseUrl}`);
  console.log(`   Version: ${descriptor.version}`);
  console.log(`   API Version: ${descriptor.apiVersion}`);
  console.log(`   Authentication: ${descriptor.authentication?.type || 'none'}`);
  console.log(`   Scopes: ${descriptor.scopes?.join(', ') || 'none'}`);
  if (descriptor.modules?.customContent) {
    console.log(`   Custom Content Modules: ${descriptor.modules.customContent.length}`);
  }
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.error('❌ Validation errors:\n');
    errors.forEach((error, index) => {
      console.error(`   ${index + 1}. ${error}`);
    });
    console.error('');
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️  Warnings:\n');
    warnings.forEach((warning, index) => {
      console.warn(`   ${index + 1}. ${warning}`);
    });
    console.warn('');
  }
  
  if (errors.length > 0) {
    console.error('❌ Validation failed. Please fix the errors above.');
    process.exit(1);
  } else {
    console.log('✅ No critical errors, but please review warnings.');
    process.exit(0);
  }
}
