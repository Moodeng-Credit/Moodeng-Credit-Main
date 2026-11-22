# Messenger reminder relay (George's Mac)

Sends the approved Messenger utility template `moodeng_repay_reminder` to borrowers we can only reach
on Messenger (no WhatsApp, push, Telegram or Viber): 2 days before, on the due day, and 1 day late.
SendPulse sends utility templates only from its dashboard (its public API refuses them, tested
2026-11-22), so `relay.mjs` drives headless Chrome with a logged-in SendPulse session and calls the
dashboard's own API.

Safety: one campaign per person, filtered on their SendPulse contact id. It sends only after SendPulse
counts exactly 1 recipient for that filter. Each (loan, due date, kind) goes out once
(`messenger_reminder_sends`). Anything due today and not sent by 11:00 Bangkok is posted to team
Telegram to send by hand (`private.messenger_reminder_watchdog`).

## Install (done 2026-11-22)

    mkdir -p ~/.moodeng-messenger-relay && cp relay.mjs ~/.moodeng-messenger-relay/
    cd ~/.moodeng-messenger-relay && npm install playwright-core
    # config.json (0600): {"supabaseUrl", "publishableKey", "token"}. Put only sha256(token) in
    # telegram_bot_settings.messenger_relay_token_sha256.
    cp app.moodeng.messenger-relay.plist ~/Library/LaunchAgents/
    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/app.moodeng.messenger-relay.plist

## Log in to SendPulse (once, and again when Telegram says it's logged out)

    node ~/.moodeng-messenger-relay/relay.mjs --login    # log in in the window, then close it
    node ~/.moodeng-messenger-relay/relay.mjs --check    # "logged in to SendPulse, API token OK"

## Switch

`telegram_bot_settings.messenger_relay_enabled` = `'true'` turns sending (and the 11:00 list) on.
Log: `~/.moodeng-messenger-relay/relay.log`.
