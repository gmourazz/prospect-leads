#!/bin/sh
# Installs the bridge as a macOS LaunchAgent: starts at login, restarts if it
# crashes, no terminal needed. Re-run to update; `--uninstall` removes it.
set -eu

LABEL="com.prospect.whatsapp-bridge"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node || true)"

if [ "${1:-}" = "--uninstall" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "bridge removido do launchd"
  exit 0
fi

[ -n "$NODE" ] || { echo "node nao encontrado no PATH" >&2; exit 1; }
[ -f "$DIR/.env" ] || { echo "falta $DIR/.env (copie de .env.example)" >&2; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents" "$DIR/logs"

# KeepAlive only on a non-zero exit: the bridge exits 0 on purpose when
# WhatsApp blocks the number or another session takes over, and restarting
# in a loop there is exactly what must not happen.
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>src/index.js</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$DIR/logs/bridge.log</string>
  <key>StandardErrorPath</key><string>$DIR/logs/bridge.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "bridge instalado. logs: $DIR/logs/bridge.log"
echo "parar: launchctl bootout gui/$(id -u)/$LABEL   |   remover: $0 --uninstall"
