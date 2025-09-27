#!/bin/bash

echo "=== Path Debug Script ==="
echo "PWD: $(pwd)"
echo "BASH_SOURCE[0]: ${BASH_SOURCE[0]}"

# Method 1: Using BASH_SOURCE
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"

echo "SCRIPT_DIR: $SCRIPT_DIR"
echo "PROJECT_ROOT: $PROJECT_ROOT"

# Test if contracts directory exists
if [ -d "$PROJECT_ROOT/contracts" ]; then
    echo "✅ Contracts directory found at: $PROJECT_ROOT/contracts"
    ls -la "$PROJECT_ROOT/contracts" | head -5
else
    echo "❌ Contracts directory NOT found at: $PROJECT_ROOT/contracts"
fi
