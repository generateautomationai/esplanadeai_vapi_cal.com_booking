# Tools and Workflows Reference

This file tracks two things for the EsplanadeAI automation stack:

1. Every tool Claude currently has available, across sessions.
2. Every n8n workflow (or Make.com scenario) we've built, so we reuse them instead of rebuilding.

Keep this file in the repo so Michael, Mick, and Claude all read the same copy. Update it whenever a tool or workflow changes.

Last updated: 2026-09-03.

## 1. Tools Claude has available

Access differs by session type. A session on Michael's home computer sees his local filesystem and any locally configured MCP servers. A cloud session (like this one) only sees the cloned git repo plus whatever MCP connectors are authorized on the account. The tables below cover the cloud/account-level tools; local sessions have those plus direct filesystem and local app access.

### Connected services (MCP connectors)

| Service | Status | What it's for |
|---|---|---|
| GitHub | Connected | Read/write repos, PRs, issues, CI checks, code search |
| Gmail | Connected | Read, search, send, and draft email |
| Google Calendar | Connected | Read, create, update, and search calendar events |
| Google Drive | Connected | Search, read, create, and share Drive files |
| Slack | Connected | Read/search channels and threads, send messages, manage lists and canvases |
| Apollo.io | Connected | Sales lead search/enrichment, contacts, deals, sequences, email campaigns |
| Higgsfield | Connected | AI image/video/audio generation, website builder, TikTok publishing |
| n8n (self-hosted) | **Not authorized** | Would give direct read/list access to n8n workflows — needed for Section 2 below |

To authorize n8n: in an interactive Claude Code session, run `/mcp` and complete its OAuth/API-key flow (or via claude.ai connector settings if it's set up as a claude.ai connector). This can't be done from a non-interactive session — someone needs to run it once locally or in an interactive web session.

### Coding and file tools

| Tool | What it's for |
|---|---|
| Read / Write / Edit | Read, create, and edit files in the current repo/session |
| Grep / Glob | Search file contents and find files by pattern |
| Bash | Run shell commands, git, npm, etc. |
| NotebookEdit | Edit Jupyter notebook cells |
| Artifact | Publish a standalone HTML/web page (dashboards, reports, mockups) with a shareable link |

### Web and research

| Tool | What it's for |
|---|---|
| WebFetch | Fetch and read a specific URL |
| WebSearch | Search the web |

### Automation and scheduling (Claude Code Remote)

| Tool | What it's for |
|---|---|
| create_trigger / update_trigger / delete_trigger / fire_trigger / list_triggers | Create recurring or one-off scheduled tasks ("Routines") that message a session on a cron schedule or at a set time |
| send_later | Schedule a one-off reminder message back into the current session |
| create_session / list_sessions / get_session / send message / archive / unarchive | Spawn and manage other Claude Code sessions, e.g. to fan out parallel work |
| subscribe_pr_activity / unsubscribe_pr_activity | Watch a GitHub PR for CI results and review comments, and auto-respond |
| watch_url / unwatch_url | Create an inbound webhook that wakes a session when something external posts to it |

### Delegation

| Tool | What it's for |
|---|---|
| Agent (subagent types: general-purpose, Explore, Plan, claude-code-guide, statusline-setup) | Hand off research or multi-step work to a specialized agent, run in the background |

### Skills (packaged workflows/instructions)

These are repeatable playbooks Claude follows when the task matches. Current ones relevant to this account:

- **design** — draft a multi-artboard visual design canvas (mockups, landing pages, posters)
- **dataviz** — build charts/dashboards with a consistent, accessible visual system
- **artifact-design / artifact-diagramming / artifact-capabilities** — guidance loaded automatically before building an Artifact page
- **update-config** — configure Claude Code's settings.json (hooks, permissions, env vars)
- **keybindings-help** — customize Claude Code keyboard shortcuts
- **code-review** — review a diff/PR for correctness and simplification issues
- **simplify** — clean up changed code for reuse/efficiency
- **fewer-permission-prompts** — reduce repeated permission prompts by allowlisting safe commands
- **loop** — run a prompt or slash command on a recurring interval
- **claude-api** — reference for the Claude API/Anthropic SDK (used automatically for any Claude/LLM-related question)
- **run** — launch and test this project's app in a browser
- **init** — generate a new CLAUDE.md for a repo
- **security-review** — security review of pending code changes
- **docx / pdf / pptx / xlsx** — create or edit Word, PDF, PowerPoint, and Excel files
- **import-memory** — import a memory export from another AI assistant
- **morning** — render or schedule Michael's morning brief
- **response-and-doc-style** — applies Michael's communication style and the Google doc style guide to every response and file
- **skill-creator** — create, edit, or benchmark new skills
- **session-start-hook** — set up a repo so Claude Code on the web can run its tests/linters at session start

## 2. n8n workflows (scenarios)

**Status: not yet populated.** Claude doesn't have authorized access to the n8n instance in this session, so this list can't be filled in automatically yet.

To complete this section, do one of the following:
- Authorize the n8n MCP connector (see above), then ask Claude to list workflows and it will fill in the table below.
- Export the workflows from n8n (Workflows → Download / or via the n8n API) and drop the JSON files into this repo, e.g. under `n8n/workflows/`, and ask Claude to document them from the files.
- Paste the list of workflow names and purposes directly, and Claude will format it here.

Once populated, each entry will look like this:

| Workflow name | Trigger | What it does | Used by | Notes |
|---|---|---|---|---|
| _example_ | Webhook from Vapi | Looks up caller availability in Cal.com and books the slot | Vapi booking assistant | — |

