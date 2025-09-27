#!/bin/bash

# neurolend Deployment Script for 0G Chain
# This script deploys the neurolend protocol to 0G Chain with Pyth Network integration

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
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

# Check if required environment variables are set
check_env_vars() {
    print_status "Checking environment variables..."
    
    if [ -z "$PRIVATE_KEY" ]; then
        print_error "PRIVATE_KEY environment variable is not set"
        echo "Please set your private key: export PRIVATE_KEY=0xyour_private_key"
        echo "Note: The private key must include the '0x' prefix"
        exit 1
    fi
    
    # Check if private key has 0x prefix
    if [[ ! "$PRIVATE_KEY" =~ ^0x ]]; then
        print_error "PRIVATE_KEY must start with '0x' prefix"
        echo "Current value: $PRIVATE_KEY"
        echo "Please update: export PRIVATE_KEY=0x$PRIVATE_KEY"
        exit 1
    fi
    
    if [ -z "$RPC_URL" ]; then
        print_warning "RPC_URL not set, using default 0G Chain RPC"
        export RPC_URL="https://evmrpc.0g.ai"
    fi
    
    print_success "Environment variables checked"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v forge &> /dev/null; then
        print_error "Foundry (forge) is not installed"
        echo "Please install Foundry: https://book.getfoundry.sh/getting-started/installation"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        echo "Please install Node.js and npm"
        exit 1
    fi
    
    print_success "Dependencies checked"
}

# Install required packages
install_packages() {
    print_status "Installing required packages..."
    
    # Get the script directory and project root
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
    PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"
    
    # Install Pyth SDK for Solidity
    cd "$PROJECT_ROOT/contracts"
    if [ ! -d "node_modules/@pythnetwork/pyth-sdk-solidity" ]; then
        npm init -y > /dev/null 2>&1 || true
        npm install @pythnetwork/pyth-sdk-solidity
        print_success "Pyth SDK installed"
    else
        print_status "Pyth SDK already installed"
    fi
    
    # Install frontend dependencies
    cd "$PROJECT_ROOT"
    if [ ! -d "node_modules" ]; then
        npm install
        print_success "Frontend dependencies installed"
    else
        print_status "Frontend dependencies already installed"
    fi
}

# Compile contracts
compile_contracts() {
    print_status "Compiling contracts..."
    
    # Get the script directory and project root
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
    PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"
    cd "$PROJECT_ROOT/contracts"
    
    if forge build; then
        print_success "Contracts compiled successfully"
    else
        print_error "Contract compilation failed"
        exit 1
    fi
}

# Deploy contracts
deploy_contracts() {
    print_status "Deploying contracts to 0G Chain..."
    
    # Get the script directory and project root
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
    PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"
    cd "$PROJECT_ROOT/contracts"
    
    # Create deployment directory if it doesn't exist
    mkdir -p deployments
    
    # Run deployment script
    if forge script script/Deploy0G.s.sol --rpc-url "$RPC_URL" --broadcast --verify --legacy; then
        print_success "Contracts deployed successfully"
    else
        print_error "Contract deployment failed"
        exit 1
    fi
    
    # Copy deployment file to root if it exists
    if [ -f "deployment-0g.env" ]; then
        cp deployment-0g.env "$PROJECT_ROOT/deployment-0g.env"
        print_success "Deployment addresses saved to deployment-0g.env"
    fi
}

# Update frontend configuration
update_frontend_config() {
    print_status "Updating frontend configuration..."
    
    # Get the script directory and project root
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
    PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"
    cd "$PROJECT_ROOT"
    
    if [ -f "deployment-0g.env" ]; then
        # Create .env.local from deployment addresses
        echo "# neurolend 0G Chain Configuration" > .env.local
        echo "# Generated automatically from deployment" >> .env.local
        echo "" >> .env.local
        
        # Add deployment addresses to .env.local
        while IFS= read -r line; do
            if [[ $line == *"="* ]] && [[ $line != "#"* ]]; then
                echo "NEXT_PUBLIC_$line" >> .env.local
            fi
        done < deployment-0g.env
        
        print_success "Frontend configuration updated"
    else
        print_warning "Deployment file not found, skipping frontend configuration update"
    fi
}

# Verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Get the script directory and project root
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
    PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"
    cd "$PROJECT_ROOT"
    
    if [ -f "deployment-0g.env" ]; then
        echo ""
        echo "=== Deployment Summary ==="
        cat deployment-0g.env | grep -v "^#" | grep "="
        echo ""
        print_success "Deployment completed successfully!"
        echo ""
        echo "🎯 neurolend Protocol is now deployed on 0G Chain!"
        echo ""
        echo "📋 Next steps:"
        echo "1. Verify the token addresses in ZeroGConfig.sol match the actual 0G Chain token contracts"
        echo "2. Test lending/borrowing functionality with the supported tokens:"
        echo "   - 0G Token (0G)"
        echo "   - Wrapped Ethereum (WETH)"
        echo "   - Wrapped Staked ETH (wstETH)"
        echo "   - USD Coin (USDC)"
        echo "3. Monitor Pyth price feeds for accurate pricing"
        echo "4. Set up liquidation bots for loan monitoring"
        echo ""
        echo "💻 Frontend configuration has been updated in .env.local"
        echo "You can now run 'npm run dev' to start the frontend"
        echo ""
        echo "📖 Documentation:"
        echo "- All price feeds are configured with Pyth Network"
        echo "- Collateral ratios are automatically calculated based on asset volatility"
        echo "- No reward tokens or mock contracts - production ready!"
    else
        print_error "Deployment verification failed - no deployment file found"
        exit 1
    fi
}

# Main deployment function
main() {
    echo ""
    echo "🚀 neurolend 0G Chain Mainnet Deployment Script"
    echo "==============================================="
    echo ""
    echo "This script will deploy the neurolend lending protocol to 0G Chain"
    echo "with support for 0G, WETH, wstETH, and USDC tokens using Pyth price feeds."
    echo ""
    
    check_env_vars
    check_dependencies
    install_packages
    compile_contracts
    deploy_contracts
    update_frontend_config
    verify_deployment
    
    print_success "🎉 neurolend Protocol deployment completed successfully!"
}

# Run main function
main "$@"
