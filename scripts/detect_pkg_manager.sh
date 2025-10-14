#!/bin/bash

detect_package_manager() {
    # Check if yarn is available and the project uses yarn
    if command -v yarn >/dev/null 2>&1 && [ -f "yarn.lock" ]; then
        echo "yarn"
        return
    fi

    # Check if the script was invoked with yarn
    if [[ "$0" == *"yarn"* ]] || [[ "$npm_config_user_agent" == *"yarn"* ]]; then
        echo "yarn"
        return
    fi

    # Check if the script is being run by npm
    if [ "$npm_execpath" ] || [ "$npm_config_user_agent" = "npm"* ]; then
        echo "npm run"
        return
    fi

    # If we can't detect from the command or environment, check for lockfiles
    if [ -f "yarn.lock" ]; then
        echo "yarn"
    elif [ -f "package-lock.json" ]; then
        echo "npm run"
    else
        # Default to npm if we can't detect
        echo "npm run"
    fi
}

PKG_MANAGER=$(detect_package_manager)
export PKG_MANAGER

echo "PKG_MANAGER: $PKG_MANAGER"