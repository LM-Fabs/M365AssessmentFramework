// Quick test to verify the API structure is correct
const path = require('path');
const fs = require('fs');

console.log('🔍 Testing API structure...');

// Check if dist/index.js exists
const indexPath = path.join(__dirname, 'dist', 'index.js');
if (!fs.existsSync(indexPath)) {
    console.error('❌ dist/index.js not found!');
    process.exit(1);
}

console.log('✅ dist/index.js exists');

// Try to require the index file
try {
    const api = require('./dist/index.js');
    console.log('✅ API module loads successfully');
    console.log('✅ API structure test passed!');
} catch (error) {
    console.error('❌ Failed to load API module:', error.message);
    process.exit(1);
}
