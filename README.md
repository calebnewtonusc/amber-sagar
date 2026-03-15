# amber-sagar

Sagar's personal Amber deployment — an iMessage-first relationship intelligence assistant.

## What it is

Amber is a living relationship memory and people-search system that lives inside iMessage. Sagar journals to Amber, and Amber helps him remember people better, search his network intelligently, and act on relationships with more wisdom and care.

## Architecture

```
Sagar texts Poke (iMessage)
  ↓
iMessage monitor → GitHub (AMBER_MESSAGES.md)
  ↓
Amber agent polls GitHub every 2s
  ↓
Claude API (with Sagar's full context + Amber persona)
  ↓
Poke API → Sagar's iMessage
  ↓
amber-core API (optional, for structured memory)
```

## Deployment

Deployed on **Railway**.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

### Environment variables

See `.env.example` for all required variables.

| Variable | Description |
|---|---|
| `CLAUDE_API_KEY` | Anthropic API key |
| `POKE_API_KEY` | Poke platform key for iMessage delivery |
| `GITHUB_TOKEN` | GitHub PAT for message polling |
| `GITHUB_MESSAGES_REPO` | Repo where messages are stored |
| `GITHUB_CONTEXT_REPO` | Repo where Sagar's context files live |
| `AMBER_API_URL` | (Optional) amber-core API for structured memory |

### Deploy to Railway

1. Fork or clone this repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select this repo
4. Add all environment variables from `.env.example`
5. Deploy

Railway will auto-detect the `railway.toml` config and start the agent.

## Context Files

Sagar's context lives in a separate private GitHub repo (`GITHUB_CONTEXT_REPO`). It should contain:

- `who-is-sagar.md` — Sagar's profile and values
- `current-context.md` — Current priorities and season of life
- `relationships-overview.md` — Key people and relationship dynamics
- `active-projects.md` — Current work and goals
- `values-and-philosophy.md` — Spiritual and personal values

## Amber Core Integration

This agent connects to `amber-core` (the shared platform) via the `AMBER_API_URL` environment variable. When connected, it uses structured memory operations (person records, memory store, people search). Without it, Amber operates in context-only mode using the conversation thread.

## Persona

Amber's persona for Sagar is configured in `config/persona/amber-persona.md`. Edit that file to adjust Amber's personality, tone, or behavior rules.

## Repo Structure

```
amber-sagar/
  agent.js                    — Main polling agent
  config/
    persona/
      amber-persona.md        — Amber's identity and behavior spec
      who-is-sagar.md         — Sagar's profile (update this)
    approval-rules/
      default.md              — What requires Sagar's approval
    ontologies/               — Custom tags and categories (to add)
  integrations/
    imessage/                 — iMessage bridge config (to add)
  docs/                       — Operating manual (to add)
  railway.toml                — Railway deployment config
  .env.example                — Required environment variables
```
