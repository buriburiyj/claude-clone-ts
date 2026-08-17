[![ci](https://github.com/buriburiyj/claude-clone-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/buriburiyj/claude-clone-ts/actions/workflows/ci.yml)

**English** · [한국어](README.ko.md)

# claude-clone-ts

A Claude Code style terminal coding agent, running on free OpenRouter models.
Tool-calling loop, approval flow, session restore and MCP integration, built from
scratch in TypeScript + Ink.

```
> where and how is wrappedTools used?
⏺ grep(wrappedTools)
  ⎿  Found 11 matches
⏺ Read(src/cli.tsx:1-100)
  ⎿  Read 100 lines
⏺ Read(src/tools/wrap.ts)
  ⎿  Read 75 lines
⏺
  wrappedTools is the tool array wrapped with event emitters.
  ...
```

## Features

**Agent loop** — streams tool calls, executes them and feeds results back.
`stepCountIs(20)` bounds the loop; a flaky model is retried three times before
falling back to the next one in the list.

**Approval flow** — file writes and shell commands ask first. When a single turn
emits several tool calls they are queued and decided one by one, so approving one
never lets the rest through implicitly. `edit_file` / `write_file` show a diff
before you decide.

**Sessions** — conversation state is persisted as JSON and restored with `/resume`.
`/compact` summarizes the history and carries it into a fresh session.

**MCP** — connects to stdio MCP servers and imports their tools. JSON Schema is
converted through zod so they behave exactly like built-in tools.

**Plan mode** — blocks write tools for read-only exploration.

## Slash commands

| Command | Description |
|---------|-------------|
| `/help` | List available commands |
| `/clear` | Clear screen and history |
| `/theme` | Switch color theme |
| `/sessions` | List past sessions |
| `/resume <id>` | Restore a session (prefix match) |
| `/cost` | Token usage and cost |
| `/context` | Context window usage |
| `/compact` | Summarize and compact the conversation |
| `/exit` | Quit |

Prefix a line with `!` to run a shell command directly (`!git status`). It skips
approval and never enters the model context.

`ctrl+o` expands folded tool output, `esc` interrupts generation, `ctrl+c` twice quits.

## Running

```bash
npm install
mkdir -p ~/.claude-clone
echo 'OPENROUTER_API_KEY=sk-or-...' > ~/.claude-clone/.env
chmod 600 ~/.claude-clone/.env
npm run dev
```

Get a key at https://openrouter.ai/keys. A project-local `.env` wins over
`~/.claude-clone/.env`, and a shell variable wins over both. The model chain is
seven entries long and wraps around on failure; edit `MODELS` in `src/llm/client.ts`.

## Token efficiency

Free models don't have much context to spare, so this was measured rather than guessed.

**Dropped duplicate MCP tools** — of the 14 filesystem MCP tools, the 9 that overlapped
with built-ins were removed and `grep` / `glob` were implemented natively.
Tool definitions went from 2,679 to 1,682 tokens.

**Partial reads** — `read_file` takes `offset` / `limit` and defaults to 200 lines.
The system prompt pushes the model to locate code with grep first and read only that
region. The same question went from reading 501 lines to 175, and the answer got
*better*, not worse — the saved budget went into depth.

**Folded output** — long shell output keeps the first 50 and last 20 lines.
Head-only truncation was dropping the error message at the end, which is usually
the part you need.

## Layout

```
src/
  cli.tsx          REPL, agent loop, slash commands
  llm/client.ts    OpenRouter client, model list
  mcp/client.ts    MCP stdio client
  tools/           fs, edit, shell, search (grep/glob), skill, wrap
  session/         state serialization, session store
  prompt/system.ts system prompt
  permissions/     plan mode
  ui/              Ink components (approval, diff, markdown, theme)
```

## Known limitations

- With parallel tool calls, `⏺` call lines and `⎿` result lines don't line up visually.
- `ctrl+o` toggles all output at once rather than an individual block.
- Resizing the terminal reflows earlier output instead of redrawing it.

## License

ISC
