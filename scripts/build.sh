#!/usr/bin/env sh
set -eu

export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"
if ! pkg-config --exists webkit2gtk-4.0; then
  printf '%s\n' "Missing WebKitGTK 4.0 development files. Install webkit2gtk4.0-devel (Fedora) or libwebkit2gtk-4.0-dev (Debian/Ubuntu)." >&2
  exit 1
fi
exec "$HOME/go/bin/wails" build "$@"
