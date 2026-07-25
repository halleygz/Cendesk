# Cendesk

A compact filesharing desktop app for `croc`.

## Requirements

- Go 1.25 or newer available on `PATH`
- Wails v2 CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- Node.js 20 or newer
- `croc` available on `PATH`
- Fedora Linux: `webkit2gtk4.0-devel` for the native WebView build

This workspace expects Go in `/usr/local/go/bin` and Wails in `$HOME/go/bin`. If a new shell cannot find them, reload your shell or run:

```bash
export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"
```

Install the Wails native WebView dependency with:

```bash
# For Fedora Linux
sudo dnf install -y webkit2gtk4.0-devel
```

## Development

```bash
wails dev
```

## Build

```bash
wails build
```

Or use:

```bash
./scripts/build.sh
```