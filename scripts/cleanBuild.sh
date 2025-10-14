#!/bin/bash

source "$(dirname "$0")/detect_pkg_manager.sh"

$PKG_MANAGER clean
if [ "$PKG_MANAGER" == "npm run" ]; then
    npm install
else
  $PKG_MANAGER install
fi
$PKG_MANAGER prettier
$PKG_MANAGER build