#!/bin/bash

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test compile_contracts function
compile_contracts() {
    print_status "Compiling contracts..."
    
    # Get the script directory and project root
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
    PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"
    
    echo "Debug: SCRIPT_DIR = $SCRIPT_DIR"
    echo "Debug: PROJECT_ROOT = $PROJECT_ROOT"
    echo "Debug: Checking if $PROJECT_ROOT/contracts exists..."
    
    if [ -d "$PROJECT_ROOT/contracts" ]; then
        echo "Debug: ✅ Directory exists"
        cd "$PROJECT_ROOT/contracts"
        echo "Debug: Changed to $(pwd)"
        
        if command -v forge &> /dev/null; then
            echo "Debug: ✅ Forge command found"
            forge build
        else
            echo "Debug: ❌ Forge command not found"
        fi
    else
        echo "Debug: ❌ Directory does not exist"
        ls -la "$PROJECT_ROOT/"
    fi
}

compile_contracts
