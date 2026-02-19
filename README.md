# AI SDK Plugin for Strapi

> **Note:** This is a personal learning project I'm building for fun to explore adding AI-native features to Strapi via a plugin. It's a work in progress.

A Strapi v5 plugin that integrates Anthropic's Claude via the Vercel AI SDK. It adds an AI-powered chat to the Strapi admin panel — complete with tool calling and a 3D avatar — and exposes everything through REST APIs and MCP.

## What It Does

- **Admin Chat** — A chat interface inside the Strapi admin panel (`/admin/api/ai-sdk/chat`) with streaming responses and tool calling
- **Public API Routes** — REST endpoints for external clients: simple prompt/response (`/api/ai-sdk/ask`), streaming (`/api/ai-sdk/ask-stream`), and full chat with tools (`/api/ai-sdk/chat`)
- **Tool Calling** — Claude can interact with your Strapi content (list content types, search and write documents) and control a 3D avatar in the admin UI (wave, nod, celebrate, think, etc.)
- **MCP Server** — All content tools are exposed via the Model Context Protocol (`/api/ai-sdk/mcp`), so AI assistants like Claude Desktop or Cursor can manage your Strapi content directly

## Setup

Configure in `server/config/plugins.ts`:

```typescript
export default ({ env }) => ({
  'ai-sdk': {
    enabled: true,
    resolve: 'src/plugins/ai-sdk',
    config: {
      anthropicApiKey: env('ANTHROPIC_API_KEY'),
      chatModel: env('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514'),
      systemPrompt: env('AI_SYSTEM_PROMPT', 'You are a helpful assistant.'),
    },
  },
});
```

## Tools

| Tool | Description | Chat | MCP |
|------|-------------|:----:|:---:|
| `listContentTypes` | List all content types and components with their fields, relations, and structure | yes | yes |
| `searchContent` | Search and query any content type with filters, full-text search, sorting, and pagination | yes | yes |
| `writeContent` | Create or update documents in any content type | yes | yes |
| `triggerAnimation` | Trigger 3D avatar animations (speak, wave, nod, think, celebrate, shake, spin) | yes | — |

## Project Structure

```
server/src/plugins/ai-sdk/
├── admin/src/          # React admin UI (chat, 3D avatar)
├── server/src/
│   ├── controllers/    # Route handlers
│   ├── services/       # Business logic bridge
│   ├── tool-logic/     # Shared tool implementations
│   ├── tools/          # AI SDK tool() wrappers for chat
│   ├── mcp/            # MCP server + tool handlers
│   ├── routes/         # Admin + content API routes
│   └── lib/            # AISDKManager, types, utils
```
