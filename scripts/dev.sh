#!/usr/bin/env sh
set -eu

export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"
exec "$HOME/go/bin/wails" dev "$@"
