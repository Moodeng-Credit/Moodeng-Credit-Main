# Viber relay

Sends Moodeng's Viber reminders and opt-in codes from George's Viber, signed in on the Android emulator
`MoodengPixel`. Viber's business API costs €100+/month; this drives the Viber app instead.

## Start it

1. Start the emulator: `~/Library/Android/sdk/emulator/emulator -avd MoodengPixel &` (Viber is installed and signed in).
2. Run `node scripts/viber-relay/relay.mjs`, and leave the terminal open. Every 20 s it sends whatever is queued.

The Mac has to stay awake while the emulator is running. If messages wait more than 10 minutes, the team Telegram
group gets an alert (`private.viber_watchdog`).

## Config

`~/.moodeng-viber-relay.json` (or the path in `VIBER_RELAY_CONFIG`):

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
