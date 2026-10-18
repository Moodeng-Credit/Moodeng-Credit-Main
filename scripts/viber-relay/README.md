# Viber relay

Sends Moodeng's Viber reminders and opt-in codes from George's Viber, signed in on the Android emulator
`MoodengPixel`. Viber's business API costs €100+/month; this drives the Viber app instead.

## How it runs (George's MacBook)

A login item, `~/Library/LaunchAgents/app.moodeng.viber-relay.plist`, runs `~/.moodeng-viber-relay/start.sh`:
it boots the emulator with no window, keeps its screen awake, and runs a copy of `relay.mjs` from
`~/.moodeng-viber-relay/`. launchd restarts it if it stops. Log: `~/.moodeng-viber-relay/relay.log`.

- Stop: `launchctl bootout gui/$(id -u)/app.moodeng.viber-relay`
- Start: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/app.moodeng.viber-relay.plist`
- After changing `relay.mjs` here, copy it to `~/.moodeng-viber-relay/` and restart.

It only runs while the Mac is awake. Anything unsent after 10 minutes goes to the team Telegram group to send
by hand (`private.viber_watchdog`).

## Config

`~/.moodeng-viber-relay/config.json` (or the path in `VIBER_RELAY_CONFIG`):

```json
{ "supabaseUrl": "https://qplmmxynzxzkfxtayoqr.supabase.co", "publishableKey": "sb_publishable_…", "token": "<Vault VIBER_RELAY_TOKEN>" }
```

## Switches (telegram_bot_settings)

- `borrower_viber_card_enabled`: shows "Get reminders on Viber" after "I don't have WhatsApp".
- `borrower_viber_enabled`: queues due-tomorrow / due-today / overdue reminders for confirmed Viber numbers.

## Tools

- `--send 63917… "text"`: send one message to a number, without Supabase.
- `--here "text"`: type and send in the chat that's open now (e.g. My Notes).
- `--dump`: print the screen's elements, to fix taps after a Viber update.
