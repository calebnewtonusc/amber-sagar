/**
 * Amber — Sagar's Relationship Intelligence Agent
 *
 * iMessage-first personal assistant.
 * Polls GitHub for new messages and responds as Amber.
 * Maintains structured memory of people, relationships, and action items.
 *
 * Adapted from poke-agent-cloud (Caleb's personal agent).
 * Deployed on Railway.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'http'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY
const POKE_API_KEY = process.env.POKE_API_KEY
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const AMBER_API_URL = process.env.AMBER_API_URL // amber-core API for memory ops
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '2000', 10)

const GITHUB_REPO = process.env.GITHUB_MESSAGES_REPO || 'calebnewtonusc/sagar-amber-messages'
const MESSAGE_FILE = 'AMBER_MESSAGES.md'
const CONTEXT_REPO = process.env.GITHUB_CONTEXT_REPO || 'calebnewtonusc/sagar-context'

let lastProcessedHash = null
let isProcessing = false
let processCount = 0
let lastError = null

// ============================================================================
// HEALTH SERVER (required by Railway)
// ============================================================================

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'running',
      agent: 'amber-sagar',
      processCount,
      lastError: lastError ? lastError.message : null,
      uptime: process.uptime()
    }))
  } else {
    res.writeHead(200)
    res.end('Amber is running.')
  }
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Health server listening on :${PORT}`)
})

// ============================================================================
// GITHUB HELPERS
// ============================================================================

function githubHeaders() {
  return {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json'
  }
}

async function readGitHubFile(repo, path) {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    { headers: githubHeaders() }
  )
  if (!response.ok) return { success: false, error: `HTTP ${response.status}` }
  const data = await response.json()
  const content = Buffer.from(data.content, 'base64').toString('utf-8')
  return { success: true, content, sha: data.sha }
}

async function writeGitHubFile(repo, path, content, message, sha = null) {
  const body = {
    message,
    content: Buffer.from(content).toString('base64')
  }
  if (sha) body.sha = sha

  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  )
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GitHub write failed: ${error}`)
  }
  return await response.json()
}

// ============================================================================
// CONTEXT LOADING
// ============================================================================

let contextCache = null
let contextCacheTime = 0
const CONTEXT_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

async function loadSagarContext() {
  const now = Date.now()
  if (contextCache && (now - contextCacheTime) < CONTEXT_CACHE_TTL) {
    return contextCache
  }

  const contextFiles = [
    'who-is-sagar.md',
    'current-context.md',
    'values-and-philosophy.md',
    'relationships-overview.md',
    'active-projects.md'
  ]

  let fullContext = ''

  for (const file of contextFiles) {
    const result = await readGitHubFile(CONTEXT_REPO, file)
    if (result.success) {
      fullContext += `\n\n# ${file}\n\n${result.content}`
    }
  }

  // Also load the persona file
  const personaResult = await readGitHubFile(
    GITHUB_REPO,
    'config/persona/amber-persona.md'
  ).catch(() => null)

  if (personaResult?.success) {
    fullContext = `# Amber Persona\n\n${personaResult.content}\n\n---\n${fullContext}`
  }

  contextCache = fullContext
  contextCacheTime = now
  return fullContext
}

// ============================================================================
// MESSAGE PARSING
// ============================================================================

async function fetchMessages() {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${MESSAGE_FILE}`,
    { headers: githubHeaders() }
  )
  if (!response.ok) throw new Error(`GitHub fetch failed: ${response.status}`)
  const data = await response.json()
  const content = Buffer.from(data.content, 'base64').toString('utf-8')
  return { content, sha: data.sha }
}

function parseMessages(content) {
  const messages = []
  const blocks = content
    .split('---\n')
    .filter(b => b.trim() && !b.includes('# Messages'))

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    let from = null
    let messageContent = ''
    let foundContent = false

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('**From:**')) {
        from = lines[i].replace('**From:**', '').trim()
      } else if (lines[i].startsWith('**Timestamp:**')) {
        foundContent = true
        i++ // skip blank line
      } else if (foundContent) {
        messageContent += lines[i] + '\n'
      }
    }

    if (from && messageContent.trim()) {
      messages.push({ from, content: messageContent.trim() })
    }
  }

  return messages
}

function needsResponse(messages) {
  if (messages.length === 0) return null
  const last = messages[messages.length - 1]
  if (last.from === 'Amber') return null
  return last
}

function buildConversationHistory(messages) {
  return messages.slice(-12).map(msg => ({
    role: msg.from === 'Amber' ? 'assistant' : 'user',
    content: msg.content
  }))
}

// ============================================================================
// CLAUDE API
// ============================================================================

async function callClaude(conversationMessages, sagarContext) {
  const systemPrompt = buildSystemPrompt(sagarContext)

  console.log(`   Context: ${sagarContext.length} chars | Messages: ${conversationMessages.length}`)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: conversationMessages
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${error}`)
  }

  const data = await response.json()
  return data.content[0].text
}

function buildSystemPrompt(sagarContext) {
  return `You are Amber, Sagar's personal relationship intelligence assistant, having a conversation via iMessage through the Poke platform.

FULL CONTEXT ABOUT SAGAR AND HIS WORLD:
${sagarContext}

---

RESPONSE GUIDELINES:
- Keep responses concise and conversational, appropriate for iMessage.
- You are Amber: motherly, wise, spiritually grounded, emotionally intelligent, and tactically sharp.
- You respect Sagar's Hindu worldview and can draw on it when it genuinely fits.
- Never send messages to other people or take outbound actions without explicit approval.
- When Sagar asks you to remember something about a person, confirm what you stored clearly.
- When Sagar searches his network, return people with: why they matched, key context, last interaction, and suggested next move.
- Approval-required actions: sending messages to others, creating group chats, scheduling external events.
- Do not pretend to be a crisis resource or mental health authority.

MEMORY OPERATIONS:
If Sagar says "remember [X about person]" or similar, extract:
- Person name(s)
- Trait, feeling, life event, action item, or trust signal
- Confirm what you stored

If Sagar searches ("who do I know that...", "who should I contact..."), return your top 3–5 matches with context.

If the amber-core API is configured (AMBER_API_URL), use it for structured memory reads and writes. Otherwise respond based on context in this conversation.`
}

// ============================================================================
// AMBER MEMORY API (amber-core integration)
// ============================================================================

async function searchPeople(query) {
  if (!AMBER_API_URL) return null
  try {
    const response = await fetch(`${AMBER_API_URL}/api/people/search?q=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${process.env.AMBER_API_KEY}` }
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

async function storeMemory(personName, memoryText, source = 'imessage') {
  if (!AMBER_API_URL) return null
  try {
    const response = await fetch(`${AMBER_API_URL}/api/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AMBER_API_KEY}`
      },
      body: JSON.stringify({ personName, content: memoryText, source })
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

// ============================================================================
// POKE DELIVERY
// ============================================================================

async function sendToUser(message) {
  const response = await fetch('https://poke.com/api/v1/inbound-sms/webhook', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${POKE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message })
  })
  if (!response.ok) throw new Error(`Poke delivery failed: ${response.status}`)
  return await response.json()
}

// ============================================================================
// LOGGING (write Amber's reply back to GitHub conversation thread)
// ============================================================================

async function logReply(content, sha, replyMessage) {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  const timeStr = now.toTimeString().split(' ')[0]

  const entry = `\n## ${dateStr} ${timeStr} - Amber Response\n\n**From:** Amber\n**Timestamp:** ${now.toISOString()}\n\n${replyMessage}\n\n---\n`
  const updatedContent = content + entry

  const result = await writeGitHubFile(
    GITHUB_REPO,
    MESSAGE_FILE,
    updatedContent,
    'Amber response',
    sha
  )

  return result
}

// ============================================================================
// MAIN PROCESSING LOOP
// ============================================================================

async function processMessages() {
  if (isProcessing) return
  isProcessing = true

  try {
    const { content, sha } = await fetchMessages()

    if (sha === lastProcessedHash) return

    console.log(`New content detected (${sha.substring(0, 7)})`)

    const messages = parseMessages(content)
    console.log(`Parsed ${messages.length} messages`)

    const messageNeedingResponse = needsResponse(messages)

    if (!messageNeedingResponse) {
      lastProcessedHash = sha
      return
    }

    console.log(`Message from ${messageNeedingResponse.from}: "${messageNeedingResponse.content.substring(0, 60)}..."`)

    const [conversationMessages, sagarContext] = await Promise.all([
      Promise.resolve(buildConversationHistory(messages)),
      loadSagarContext()
    ])

    console.log('Calling Claude...')
    const amberResponse = await callClaude(conversationMessages, sagarContext)
    console.log(`Amber: "${amberResponse.substring(0, 60)}..."`)

    await sendToUser(amberResponse)
    console.log('Delivered via Poke')

    const result = await logReply(content, sha, amberResponse)
    lastProcessedHash = result.content.sha
    processCount++

    console.log(`Done (cycle #${processCount})\n`)
    lastError = null

  } catch (error) {
    lastError = error
    console.error('Error:', error.message)
  } finally {
    isProcessing = false
  }
}

// ============================================================================
// STARTUP
// ============================================================================

async function start() {
  console.log('Starting Amber — Sagar\'s Relationship Intelligence Agent')
  console.log(`Poll interval: ${POLL_INTERVAL}ms`)
  console.log(`Messages repo: ${GITHUB_REPO}/${MESSAGE_FILE}`)
  console.log(`Context repo: ${CONTEXT_REPO}`)
  console.log(`Model: ${process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'}`)
  if (AMBER_API_URL) console.log(`Memory API: ${AMBER_API_URL}`)
  console.log('---\n')

  // Check required env vars
  const required = ['CLAUDE_API_KEY', 'POKE_API_KEY', 'GITHUB_TOKEN']
  const missing = required.filter(k => !process.env[k])
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`)
    process.exit(1)
  }

  // Initial context load test
  try {
    const context = await loadSagarContext()
    console.log(`Context loaded: ${context.length} chars`)
  } catch (err) {
    console.warn(`Could not load context: ${err.message}`)
  }

  // Initial poll
  await processMessages()

  // Start polling
  setInterval(processMessages, POLL_INTERVAL)

  console.log('Amber is running.\n')
}

process.on('SIGINT', () => {
  console.log('\nShutting down Amber...')
  process.exit(0)
})

start()
