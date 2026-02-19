#!/bin/bash

source "$(dirname "$0")/detect_pkg_manager.sh"

$PKG_MANAGER prettier
bash scripts/clean.sh --skip node_modules npm_cache package-lock
$PKG_MANAGER build

if [ "$1" = "dev" ] || [ "$1" = "dev:local" ]; then
  $PKG_MANAGER $1
else
  $PKG_MANAGER start
fi