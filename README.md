# amber-sagar

Sagar's Amber relationship intelligence agent — iMessage via [Loop Message](https://loopmessage.com), deployed on Railway.

Adapted from `amber-caleb`. Built on the Amber platform (`amber-core`).

## Architecture

```
Sagar texts his Loop Message number
        ↓
Loop Message → POST /webhook → agent.js
        ↓
Claude claude-sonnet-4-6 + Amber persona + Sagar's context (GitHub)
        ↓
Loop Message API → Sagar's iMessage
```

Polls `calebnewtonusc/sagar-amber-messages/AMBER_MESSAGES.md` for async/fallback messaging.

## Env Vars (set in Railway dashboard)

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `LOOP_API_KEY` | From [app.loopmessage.com](https://app.loopmessage.com) → Org → API Key |
| `LOOP_SENDER_ID` | Sagar's Loop Message sender UUID |
| `SAGAR_PHONE_NUMBER` | Sagar's phone in E.164 |
| `GITHUB_TOKEN` | PAT with repo read/write |
| `GITHUB_MESSAGES_REPO` | `calebnewtonusc/sagar-amber-messages` |
| `GITHUB_CONTEXT_REPO` | `calebnewtonusc/sagar-context` |

## Deploy

```bash
railway login
export LOOP_API_KEY=...
export LOOP_SENDER_ID=...
export SAGAR_PHONE_NUMBER=...
export ANTHROPIC_API_KEY=...
export GITHUB_TOKEN=...
bash deploy.sh
```

Then in [Loop Message dashboard](https://app.loopmessage.com):
- Sender → Webhooks → set URL to `https://<railway-url>/webhook`

## Endpoints

- `POST /webhook` — Loop Message inbound message handler  
- `GET /health` — health check
