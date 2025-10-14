#!/bin/bash
source "$(dirname "$0")/detect_pkg_manager.sh"
bash ./scripts/cleanBuild.sh

if [ "$1" = "dev" ] || [ "$1" = "dev:local" ]; then
  $PKG_MANAGER $1
else
  $PKG_MANAGER start
fi