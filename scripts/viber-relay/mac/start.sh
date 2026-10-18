#!/bin/zsh
# Started at login by ~/Library/LaunchAgents/app.moodeng.viber-relay.plist (and restarted if it exits).
# Boots the MoodengPixel emulator with no window if it isn't running, keeps its screen awake so the
# relay can tap, then runs the relay loop. Logs: ~/.moodeng-viber-relay/relay.log
# To see the Viber screen: quit this (launchctl unload …) and run the emulator normally, or use scrcpy.

export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
SDK="$HOME/Library/Android/sdk"
ADB="$SDK/platform-tools/adb"
DIR="$HOME/.moodeng-viber-relay"

# Boot the emulator when it isn't running (no window), then wait for it. Checked in a loop, so an
# emulator that is shutting down when this starts gets booted again instead of waited on forever.
for i in {1..60}; do
  if "$ADB" devices | grep -q '^emulator-5554[[:space:]]*device'; then
    [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]] && break
  elif ! pgrep -f 'qemu.*MoodengPixel' >/dev/null; then
    echo "$(date) starting emulator (no window)"
    "$SDK/emulator/emulator" -avd MoodengPixel -no-window -no-audio -no-boot-anim >> "$DIR/emulator.log" 2>&1 &
  fi
  sleep 5
done

# Screen on and unlocked, always: taps don't land on a sleeping screen.
"$ADB" shell svc power stayon true
"$ADB" shell settings put system screen_off_timeout 2147483647
"$ADB" shell locksettings set-disable true >/dev/null 2>&1
"$ADB" shell input keyevent KEYCODE_WAKEUP
"$ADB" shell wm dismiss-keyguard >/dev/null 2>&1

echo "$(date) emulator ready, starting relay"
exec node "$DIR/relay.mjs"
