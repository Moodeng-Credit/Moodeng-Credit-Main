#!/bin/bash

if [ $# -ne 1 ]; then
    echo "Usage: $0 <relative_path>"
    echo "The script will encrypt if the file is plain, decrypt if encrypted (contains 'encrypted:' prefix)"
    exit 1
fi

file=$1

if [ ! -f "$file" ]; then
    echo "File $file does not exist"
    exit 1
fi

# Determine environment and set key
file_base=$(basename "$file")
if [[ "$file_base" == .env.* ]]; then
    env_part=${file_base#.env.}
    if [[ "$env_part" == "production" ]]; then
        key_var="DOTENV_PRIVATE_KEY_PRODUCTION"
    elif [[ "$env_part" == "staging" ]]; then
        key_var="DOTENV_PRIVATE_KEY_STAGING"
    else
        echo "Unsupported environment: $env_part"
        exit 1
    fi
else
    echo "File must be named .env.<env>"
    exit 1
fi

if [ ! -f ".env.keys" ]; then
    echo ".env.keys not found"
    exit 1
fi

key=$(grep "$key_var" .env.keys | cut -d'=' -f2)
if [ -z "$key" ]; then
    echo "Key not found in .env.keys"
    exit 1
fi

export DOTENV_PRIVATE_KEY="$key"

# Check if the file is encrypted (contains 'encrypted:' in the first few lines)
if head -n 100 "$file" | grep -q "encrypted:"; then
    # Decrypt
    echo "Decrypting $file..."
    dotenvx decrypt --env-file "$file"
    echo "Decrypted $file"
else
    # Encrypt
    echo "Encrypting $file..."
    dotenvx encrypt --env-file "$file"
    echo "Encrypted $file"
fi