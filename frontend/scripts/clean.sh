#!/bin/bash

# kill any existing processes
pkill -f "next"

# Add package manger to env
source "$(dirname "$0")/detect_pkg_manager.sh"

# Flags indicating whether to skip
declare -A skips

# Process command line options
while [[ "$#" -gt 0 ]]; do
    case "$1" in
        --skip|-s)
            while [[ "$#" -gt 1 ]] && [[ "${2:0:1}" != "-" ]]; do
                skips[$2]=1
                shift
            done
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
    shift
done

# echo "NODE_ENV:", $NODE_ENV
# echo unsetting NODE_ENV
# unset NODE_ENV
# echo "NODE_ENV:", $NODE_ENV

# Source nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
echo "Cleaning nvm cache..."
nvm cache clear

# Run the Python script to remove Zone.Identifier files and capture its output
echo "Removing Zone.Identifier files..."
python_output=$(python3 scripts/remove_zone_identifier_files.py)
echo "$python_output"

   # Kill any existing Next.js processes
    echo "Killing existing Next.js processes..."
    pkill -f "next"

   echo "Removing .next directory..."
    rm -rf ./.next

# Remove build directories
if [[ -z "${skips[build]}" ]]; then
    echo "Removing build directory..."
    rm -rf ./build
fi

if [[ -z "${skips[dist]}" ]]; then
    echo "Removing dist directory..."
    rm -rf ./dist
fi

# Perform clean up based on skip flags

if [[ -z "${skips[node_modules]}" ]]; then
    echo "Removing node_modules directory..."
    rm -rf ./node_modules

fi

if [[ -z "${skips[package-lock]}" ]]; then
    echo "Removing package-lock.json..."
    rm -rf ./package-lock.json
    rm -rf ./yarn.lock
fi

if [[ -z "${skips[npm_cache]}" ]]; then
    echo "Cleaning npm cache..."
    npm cache clean --force
    npm cache verify
fi