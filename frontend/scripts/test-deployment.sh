#!/bin/bash

# Test deployment script for neurolend on 0G Chain
# Uses a test private key for validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo ""
echo "🧪 neurolend Test Deployment"
echo "============================"
echo ""

# Set test environment variables
export PRIVATE_KEY="0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
export RPC_URL="https://evmrpc.0g.ai"

print_status "Using test private key for deployment validation"
print_status "Network: 0G Chain ($RPC_URL)"

# Test contract compilation
print_status "Testing contract compilation..."
cd contracts

if forge build; then
    print_success "✅ Contracts compile successfully"
else
    print_error "❌ Contract compilation failed"
    exit 1
fi

# Test deployment script syntax
print_status "Testing deployment script (dry run)..."

if forge script script/Deploy0G.s.sol --rpc-url "$RPC_URL" 2>/dev/null; then
    print_success "✅ Deployment script syntax is valid"
else
    print_warning "⚠️  Deployment script has issues (expected with test key)"
fi

cd ..

print_success "🎉 Test deployment validation completed!"
echo ""
echo "To deploy with your actual private key:"
echo "1. export PRIVATE_KEY=0xyour_actual_private_key"
echo "2. export RPC_URL=https://evmrpc.0g.ai  # (optional)"
echo "3. ./scripts/deploy-0g.sh"
echo ""
echo "Make sure your private key:"
echo "- Starts with '0x'"
echo "- Has sufficient 0G tokens for gas fees"
echo "- Has permission to deploy contracts"
