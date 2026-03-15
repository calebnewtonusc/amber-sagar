# amber-sagar

Your personal Amber relationship intelligence agent — iMessage-first, deployed on Railway.

Amber helps you remember people, track relationships, and surface the right connections at the right time.

---

## What Amber does

- **Remembers people** — "Remember that Rohan hates flakey planners"
- **Surfaces connections** — "Who do I know in fintech who values honesty?"
- **Tracks action items** — "Remind me to follow up with Dev on Tuesday"
- **Guards your privacy** — never sends messages to others without your explicit approval

---

## Setup (one-time, ~20 minutes)

### 1. Get your Loop Message sender

1. Go to [app.loopmessage.com](https://app.loopmessage.com) and sign up
2. Create an organization and a new **Sender**
3. Copy your **Sender ID** (UUID) and your **Organization API Key**
4. Activation takes up to 2 business days — set everything else up while you wait

### 2. Create your GitHub repos

Create two **private** repos on your GitHub:

- `sagar-amber-messages` — conversation thread (needs one file: `AMBER_MESSAGES.md` with content `# Amber Messages\n`)
- `sagar-context` — your personal context (copy the files from `config/persona/` here and fill them in)

Generate a GitHub Personal Access Token with `repo` scope at [github.com/settings/tokens](https://github.com/settings/tokens).

### 3. Deploy on Railway

1. Sign up at [railway.com](https://railway.com)
2. Install the CLI: `npm install -g @railway/cli`
3. Clone this repo: `git clone https://github.com/calebnewtonusc/amber-sagar.git`
4. Run:

```bash
cd amber-sagar
railway login
railway init --name "amber-sagar"
railway add --service amber-sagar-agent \
  -v ANTHROPIC_API_KEY="your-anthropic-key" \
  -v LOOP_API_KEY="your-loop-message-org-api-key" \
  -v LOOP_SENDER_ID="your-loop-sender-uuid" \
  -v SAGAR_PHONE_NUMBER="+16308859331" \
  -v GITHUB_TOKEN="your-github-pat" \
  -v GITHUB_MESSAGES_REPO="your-github-username/sagar-amber-messages" \
  -v GITHUB_CONTEXT_REPO="your-github-username/sagar-context"
railway domain --service amber-sagar-agent
railway up --service amber-sagar-agent --detach
```

5. Copy the Railway domain URL, then go to Loop Message dashboard → your Sender → **Webhooks** → add:
   ```
   https://<your-railway-url>/webhook
   ```

### 4. Fill in your context

Edit the files in `config/persona/` and push them to your `sagar-context` GitHub repo:

- `who-is-sagar.md` — your background, personality, goals
- `values-and-philosophy.md` — what you believe, your spiritual worldview
- `relationships-overview.md` — people in your life and how you know them
- `current-context.md` — what's going on in your life right now

The more detail you give Amber, the smarter she gets.

### 5. Get your Anthropic API key

Sign up at [console.anthropic.com](https://console.anthropic.com) and create an API key.

---

## Texting Amber

Once deployed and your sender is activated, text your Loop Message number from your iPhone.

**Examples:**
- "Remember that Priya is going through a hard time with her family"
- "Who do I know at Google?"
- "I need to follow up with Dev about the startup idea — remind me Thursday"
- "What do I know about Rohan?"

---

## Endpoints

- `POST /webhook` — Loop Message inbound messages
- `GET /health` — health check
