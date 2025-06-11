#!/bin/bash
# force-node-version.sh - Forces Node.js 18 for all project components

set -e # Exit immediately if a command exits with a non-zero status

echo "🔍 Checking current Node.js environment..."
NODE_PATH=$(which node)
NODE_VERSION=$(node -v)
echo "Current Node Path: $NODE_PATH"
echo "Current Node Version: $NODE_VERSION"

# Setup NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm

# Check if Node.js 18 is already installed via nvm
echo "🔧 Ensuring Node.js 18 is installed..."
if ! nvm ls 18 >/dev/null 2>&1; then
  echo "Installing Node.js 18 via nvm..."
  nvm install 18
fi

# Force use of Node.js 18
echo "🔄 Switching to Node.js 18..."
nvm use 18
NODE_VERSION_NEW=$(node -v)
echo "Now using Node.js $NODE_VERSION_NEW"

# Update all .nvmrc files to ensure consistency
echo "📝 Updating .nvmrc files across the project..."
echo "18" > .nvmrc
echo "18" > m365-assessment-framework/.nvmrc
if [ -d "api" ]; then
  echo "18" > api/.nvmrc
fi
if [ -d "m365-assessment-framework/api" ]; then
  echo "18" > m365-assessment-framework/api/.nvmrc
fi

# Verify package managers are using the correct version
echo "🔍 Verifying npm version..."
NPM_VERSION=$(npm -v)
echo "Using npm $NPM_VERSION with Node.js $NODE_VERSION_NEW"

# Clean npm cache to avoid any cached dependencies with wrong Node.js version
echo "🧹 Cleaning npm cache..."
npm cache clean --force

# Clear node_modules to ensure clean installs with correct Node.js version
echo "🗑️ Removing existing node_modules..."
find . -name "node_modules" -type d -exec rm -rf {} +  2>/dev/null || true

# Reinstall dependencies with the correct Node.js version
echo "📦 Reinstalling dependencies in main project..."
npm install

echo "📦 Reinstalling dependencies in m365-assessment-framework..."
cd m365-assessment-framework
npm install
cd ..

# Also reinstall API dependencies if they exist
if [ -d "m365-assessment-framework/api" ]; then
  echo "📦 Reinstalling dependencies in m365-assessment-framework/api..."
  cd m365-assessment-framework/api
  npm install
  cd ../..
fi

echo "✅ Node.js environment has been forcibly set to version 18 across all components!"
echo "✅ All node_modules have been reinstalled with the correct Node.js version!"
echo "📋 Remember to use 'nvm use 18' before running any npm commands in this project."

# Force Node.js version for Azure Functions compatibility
# Azure Functions Core Tools v4 supports Node.js 18 and 20, but not 22

echo "Checking Node.js version compatibility for Azure Functions..."

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)

if [ "$NODE_VERSION" -ge 22 ]; then
    echo "❌ Node.js version $NODE_VERSION is not compatible with Azure Functions Core Tools v4"
    echo "🔧 Azure Functions v4 supports Node.js 18 and 20"
    echo "📝 Please use Node.js 20 for Azure Functions compatibility"
    
    # Check if nvm is available
    if command -v nvm &> /dev/null; then
        echo "🔄 Attempting to switch to Node.js 20 using nvm..."
        nvm use 20 2>/dev/null || nvm install 20
        echo "✅ Switched to Node.js $(node --version)"
    else
        echo "💡 Install nvm and run: nvm install 20 && nvm use 20"
        echo "   Or download Node.js 20 from: https://nodejs.org/"
        exit 1
    fi
elif [ "$NODE_VERSION" -eq 20 ] || [ "$NODE_VERSION" -eq 18 ]; then
    echo "✅ Node.js version $NODE_VERSION is compatible with Azure Functions"
else
    echo "⚠️  Node.js version $NODE_VERSION is below recommended. Consider upgrading to Node.js 20"
fi