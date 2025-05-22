#!/bin/bash
# setup-env.sh - Environment setup script for M365 Assessment Framework

# Load nvm if it exists
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install and use the correct Node.js version
echo "Setting up Node.js environment..."
if command -v nvm &> /dev/null; then
  # Use nvm to manage Node.js version
  echo "Using nvm to manage Node.js version"
  nvm install 18
  nvm use 18
else
  # Check node version if nvm is not available
  NODE_VERSION=$(node -v)
  if [[ ! $NODE_VERSION =~ ^v18 ]]; then
    echo "Warning: Using Node.js $NODE_VERSION, but project requires v18.x"
    echo "Please install Node.js v18.x or use nvm to manage Node.js versions"
  else
    echo "Using Node.js $NODE_VERSION"
  fi
fi

# Verify npm version
NPM_VERSION=$(npm -v)
echo "Using npm $NPM_VERSION"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm ci
else
  echo "Dependencies already installed."
fi

# Set environment variables
echo "Setting up environment variables..."
export NODE_ENV=development
export CI=false

echo "Environment setup complete!"
echo "Run 'npm run dev' to start the development server"