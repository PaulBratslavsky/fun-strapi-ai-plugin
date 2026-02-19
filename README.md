# AI SDK Plugin — Architecture Guide

A Strapi v5 plugin that integrates Anthropic's Claude models via the Vercel AI SDK. It provides a chat interface with tool-calling in the Strapi admin, REST API endpoints for external clients, and an MCP (Model Context Protocol) server for AI assistants like Claude Desktop.

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Plugin Lifecycle](#plugin-lifecycle)
- [Directory Structure](#directory-structure)
- [Server Side](#server-side)
  - [Configuration](#configuration)
  - [AI SDK Manager](#ai-sdk-manager)
  - [API Endpoints](#api-endpoints)
  - [Service Layer](#service-layer)
  - [Shared Tool Logic](#shared-tool-logic)
  - [AI SDK Tools (Chat)](#ai-sdk-tools-chat)
  - [MCP Server](#mcp-server)
- [Admin Side](#admin-side)
  - [Chat Interface](#chat-interface)
  - [3D Avatar](#3d-avatar)
- [Data Flow](#data-flow)
  - [Chat Flow (Admin UI)](#chat-flow-admin-ui)
  - [MCP Flow (Claude Desktop)](#mcp-flow-claude-desktop)
- [Testing](#testing)
- [Key Patterns](#key-patterns)

---

## High-Level Architecture

```mermaid
graph TB
    subgraph Clients
        A[Strapi Admin UI<br/>Chat + 3D Avatar]
        B[External App<br/>REST API]
        C[Claude Desktop<br/>MCP Client]
    end

    subgraph Strapi Plugin: ai-sdk
        subgraph Routes
            R1[POST /admin/api/ai-sdk/chat]
            R2[POST /api/ai-sdk/ask]
            R3[POST /api/ai-sdk/ask-stream]
            R4[POST /api/ai-sdk/chat]
            R5[POST/GET/DELETE /api/ai-sdk/mcp]
        end

        subgraph Controllers
            CC[controller]
            MC[mcp]
        end

        subgraph Service
            SVC[service.ts]
        end

        subgraph Core
            MGR[AISDKManager<br/>Anthropic Provider]
        end

        subgraph Shared Tool Logic
            TL1[listContentTypes]
            TL2[searchContent]
            TL3[writeContent]
        end

        subgraph AI SDK Tools
            T1[listContentTypes<br/>tool wrapper]
            T2[searchContent<br/>tool wrapper]
            T3[writeContent<br/>tool wrapper]
            T4[triggerAnimation<br/>admin-only]
        end

        subgraph MCP Server
            MS[MCP Server<br/>@modelcontextprotocol/sdk]
            MT1[list_content_types<br/>MCP handler]
            MT2[search_content<br/>MCP handler]
            MT3[write_content<br/>MCP handler]
        end
    end

    subgraph Strapi Core
        DB[(Database)]
        DOC[Document Service]
        CT[Content Types]
    end

    A --> R1
    B --> R2 & R3 & R4
    C --> R5

    R1 & R4 --> CC
    R2 & R3 --> CC
    R5 --> MC

    CC --> SVC --> MGR
    SVC --> T1 & T2 & T3 & T4

    MC --> MS --> MT1 & MT2 & MT3

    T1 --> TL1
    T2 --> TL2
    T3 --> TL3

    MT1 --> TL1
    MT2 --> TL2
    MT3 --> TL3

    TL1 --> CT
    TL2 --> DOC
    TL3 --> DOC
    DOC --> DB
```

---

## Plugin Lifecycle

```mermaid
sequenceDiagram
    participant Strapi
    participant Register
    participant Bootstrap
    participant Destroy

    Strapi->>Register: register()
    Register->>Register: Read plugin config
    Register->>Register: Initialize AISDKManager<br/>(Anthropic API key + model)
    Register-->>Strapi: Ready

    Strapi->>Bootstrap: bootstrap()
    Bootstrap->>Bootstrap: Create MCP server factory
    Bootstrap->>Bootstrap: Initialize MCP session map
    Bootstrap-->>Strapi: MCP endpoint available

    Note over Strapi: Plugin running...

    Strapi->>Destroy: destroy()
    Destroy->>Destroy: Close all MCP sessions
    Destroy->>Destroy: Clean up references
    Destroy-->>Strapi: Shutdown complete
```

| Phase | File | What Happens |
|-------|------|-------------|
| **Register** | `register.ts` | Reads `anthropicApiKey` and `chatModel` from config. Initializes the `AISDKManager` singleton with the Anthropic provider. |
| **Bootstrap** | `bootstrap.ts` | Stores a `createMcpServer` factory and a `mcpSessions` Map on the plugin instance. Logs the MCP endpoint URL. |
| **Destroy** | `destroy.ts` | Iterates all active MCP sessions, closes servers and transports, clears references. |

---

## Directory Structure

```
server/src/plugins/ai-sdk/
├── admin/src/                     # React admin UI
│   ├── components/
│   │   ├── Avatar3D/              # 3D avatar (raw Three.js)
│   │   │   ├── Avatar3D.tsx       # Scene, renderer, camera, animation loop
│   │   │   ├── PlaceholderModel.ts# Procedural humanoid model
│   │   │   └── animations.ts     # 8 animation factories
│   │   ├── AvatarPanel.tsx        # Avatar container panel
│   │   ├── Chat.tsx               # Chat UI component
│   │   ├── Initializer.tsx        # Plugin initializer
│   │   └── PluginIcon.tsx         # Sidebar icon
│   ├── context/
│   │   └── AvatarAnimationContext.tsx  # Animation state context
│   ├── hooks/
│   │   └── useChat.ts            # Chat hook (SSE + AI SDK protocol)
│   ├── pages/
│   │   ├── App.tsx               # Router
│   │   └── HomePage.tsx          # Main page (Chat + Avatar)
│   └── utils/
│       ├── auth.ts               # Admin auth token helper
│       └── sse.ts                # SSE stream parsing
│
├── server/src/                    # Node.js server
│   ├── config/index.ts           # Plugin config schema + defaults
│   ├── controllers/
│   │   ├── index.ts              # Exports: controller, mcp
│   │   ├── controller.ts         # ask, askStream, chat endpoints
│   │   └── mcp.ts                # MCP HTTP transport handler
│   ├── services/
│   │   ├── index.ts              # Exports: service
│   │   └── service.ts            # ask, askStream, chat, isInitialized
│   ├── lib/
│   │   ├── init-ai-sdk.ts        # AISDKManager singleton
│   │   ├── types.ts              # PluginConfig, model names, input types
│   │   └── utils.ts              # Validation, SSE helpers
│   ├── tool-logic/               # SHARED business logic
│   │   ├── index.ts              # Barrel exports
│   │   ├── list-content-types.ts # Core: list content types + components
│   │   ├── search-content.ts     # Core: query documents
│   │   └── write-content.ts      # Core: create/update documents
│   ├── tools/                    # AI SDK tool() wrappers (for chat)
│   │   ├── index.ts              # createTools(), describeTools()
│   │   ├── list-content-types.ts # AI SDK wrapper → tool-logic
│   │   ├── search-content.ts     # AI SDK wrapper → tool-logic
│   │   ├── write-content.ts      # AI SDK wrapper → tool-logic
│   │   └── trigger-animation.ts  # Admin-only (no shared logic)
│   ├── mcp/                      # MCP server (for Claude Desktop)
│   │   ├── index.ts              # Barrel exports
│   │   ├── server.ts             # createMcpServer()
│   │   ├── schemas/index.ts      # Zod validation schemas
│   │   ├── tools/
│   │   │   ├── index.ts          # Tool registry + handleToolCall
│   │   │   ├── list-content-types.ts  # MCP handler → tool-logic
│   │   │   ├── search-content.ts      # MCP handler → tool-logic
│   │   │   └── write-content.ts       # MCP handler → tool-logic
│   │   └── utils/
│   │       └── sanitize.ts       # Input/output sanitization
│   ├── routes/
│   │   ├── index.ts              # Combines content-api + admin routes
│   │   ├── content-api/index.ts  # Public routes: ask, ask-stream, chat, mcp
│   │   └── admin/index.ts        # Admin route: chat
│   ├── bootstrap.ts
│   ├── destroy.ts
│   ├── register.ts
│   └── index.ts                  # Main plugin export
│
└── package.json
```

---

## Server Side

### Configuration

Configured in `server/config/plugins.ts`:

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

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `anthropicApiKey` | Yes | — | Anthropic API key |
| `chatModel` | No | `claude-sonnet-4-20250514` | Model to use |
| `systemPrompt` | No | `''` | Default system prompt for chat |
| `baseURL` | No | — | Custom Anthropic API base URL |

**Supported models:** `claude-sonnet-4-20250514`, `claude-opus-4-20250514`, `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-haiku-20240307`

### AI SDK Manager

`lib/init-ai-sdk.ts` — Singleton that wraps the Anthropic provider.

```mermaid
classDiagram
    class AISDKManager {
        -provider: AnthropicProvider
        -model: ChatModelName
        +initialize(config): boolean
        +generateText(prompt, options): GenerateTextResult
        +streamText(prompt, options): StreamTextResult
        +streamRaw(input): StreamTextRawResult
        +getChatModel(): ChatModelName
        +isInitialized(): boolean
        +destroy(): void
    }

    class GenerateInput {
        <<interface>>
        system?: string
        temperature?: number
        maxOutputTokens?: number
        tools?: ToolSet
        stopWhen?: StopCondition
    }

    class PromptInput {
        prompt: string
    }

    class MessagesInput {
        messages: ModelMessage[]
    }

    GenerateInput <|-- PromptInput
    GenerateInput <|-- MessagesInput
    AISDKManager --> GenerateInput : uses
```

Key methods:

| Method | Returns | Used By |
|--------|---------|---------|
| `generateText(prompt)` | `{ text: string }` | `/ask` endpoint |
| `streamText(prompt)` | `{ textStream }` | `/ask-stream` endpoint |
| `streamRaw(input)` | Raw AI SDK result with `toUIMessageStreamResponse()` | `/chat` endpoint |

### API Endpoints

```mermaid
graph LR
    subgraph Content API - Public
        E1["POST /api/ai-sdk/ask"]
        E2["POST /api/ai-sdk/ask-stream"]
        E3["POST /api/ai-sdk/chat"]
        E4["POST/GET/DELETE /api/ai-sdk/mcp"]
    end

    subgraph Admin API - Authenticated
        E5["POST /admin/api/ai-sdk/chat"]
    end

    E1 -->|"{ prompt, system? }"| R1["JSON response<br/>{ data: { text } }"]
    E2 -->|"{ prompt, system? }"| R2["SSE stream<br/>data: { text }"]
    E3 -->|"{ messages, system? }"| R3["UI Message Stream v1<br/>AI SDK protocol"]
    E4 -->|"JSON-RPC"| R4["MCP Streamable HTTP<br/>SSE responses"]
    E5 -->|"{ messages, system? }"| R3
```

#### POST `/api/ai-sdk/ask`
Simple prompt-in, text-out. Returns `{ data: { text: "..." } }`.

#### POST `/api/ai-sdk/ask-stream`
Prompt-in, SSE stream out. Each chunk: `data: {"text":"..."}`. Ends with `data: [DONE]`.

#### POST `/api/ai-sdk/chat` (content-api + admin)
Full chat with tool-calling. Uses the AI SDK UI Message Stream v1 protocol, compatible with `useChat` from `@ai-sdk/react`.

**Request body:**
```json
{
  "messages": [
    { "id": "msg-1", "role": "user", "parts": [{ "type": "text", "text": "..." }] }
  ],
  "system": "optional system prompt"
}
```

**Response:** Streaming `text/event-stream` with `x-vercel-ai-ui-message-stream: v1` header.

#### POST/GET/DELETE `/api/ai-sdk/mcp`
MCP Streamable HTTP transport. See [MCP Server](#mcp-server) section.

### Service Layer

`services/service.ts` — Bridges controllers with the AI SDK Manager and tools.

```mermaid
flowchart LR
    C[Controller] --> S[Service]
    S --> |prompt| MGR[AISDKManager]
    S --> |messages| MGR
    S --> |create tools| T[createTools]
    S --> |describe tools| D[describeTools]
    T --> MGR
    D --> |system prompt| MGR
```

The `chat()` method:
1. Converts UI messages to model messages via `convertToModelMessages()`
2. Creates all tools via `createTools(strapi)` — includes `triggerAnimation`
3. Auto-generates a tool description system prompt via `describeTools()`
4. Calls `aiSDKManager.streamRaw()` with a `stepCountIs(6)` stop condition (max 6 tool-call rounds)

### Shared Tool Logic

The `tool-logic/` directory contains pure business logic functions shared between the AI SDK chat tools and MCP tools:

```mermaid
graph TB
    subgraph "tool-logic/ (shared)"
        L[listContentTypes]
        S[searchContent]
        W[writeContent]
    end

    subgraph "tools/ (AI SDK chat)"
        AT1["tool() wrapper"] --> L
        AT2["tool() wrapper"] --> S
        AT3["tool() wrapper"] --> W
    end

    subgraph "mcp/tools/ (MCP server)"
        MT1["MCP handler"] --> L
        MT2["MCP handler"] --> S
        MT3["MCP handler"] --> W
    end

    L --> CT[strapi.contentTypes<br/>strapi.components]
    S --> DOC1["strapi.documents().findMany()<br/>strapi.documents().count()"]
    W --> DOC2["strapi.documents().create()<br/>strapi.documents().update()"]
```

#### `listContentTypes(strapi)`
- Iterates `strapi.contentTypes`, filters out `admin::` and `strapi::` prefixes
- Extracts fields, relations, component references from attributes
- Filters out internal fields (`createdAt`, `updatedBy`, etc.)
- Also collects component summaries from `strapi.components`
- Returns `{ contentTypes: ContentTypeSummary[], components: ComponentSummary[] }`

#### `searchContent(strapi, params)`
- Validates the content type UID exists
- Calls `strapi.documents(uid).findMany()` with filters, sort, pagination, full-text search
- Caps page size at 50
- Calls `.count()` for total
- Returns `{ results, pagination: { page, pageSize, total } }`

#### `writeContent(strapi, params)`
- Validates content type exists
- Validates `documentId` is present for updates
- Calls `.create()` or `.update()` on `strapi.documents(uid)`
- Returns `{ action, document }`

### AI SDK Tools (Chat)

Located in `tools/`. Each file exports a `create*Tool(strapi)` function that returns an AI SDK `tool()` object. These are used by the chat service for Claude's tool-calling.

| Tool | Description | Admin-only? |
|------|-------------|-------------|
| `listContentTypes` | Discover content types and components | No |
| `searchContent` | Query any content type with filters, search, pagination | No |
| `writeContent` | Create or update documents | No |
| `triggerAnimation` | Trigger 3D avatar animations in the admin UI | **Yes** |

The `triggerAnimation` tool is intentionally **not** exposed via MCP — it only makes sense in the admin chat context where the 3D avatar is rendered.

**AI SDK v6 + Zod v4 pattern:**
```typescript
tool({
  description: '...',
  inputSchema: zodSchema(z.object({ ... })),  // MUST wrap with zodSchema()
  execute: async (params) => sharedLogicFunction(strapi, params),
});
```

### MCP Server

The MCP server exposes the same content management tools to external AI clients (Claude Desktop, Cursor, etc.) via the [Model Context Protocol](https://modelcontextprotocol.io/).

```mermaid
sequenceDiagram
    participant Client as Claude Desktop
    participant Transport as Streamable HTTP<br/>/api/ai-sdk/mcp
    participant Controller as MCP Controller
    participant Server as MCP Server
    participant Tools as Tool Handlers
    participant Strapi as Strapi Document API

    Client->>Transport: POST initialize<br/>{protocolVersion, capabilities, clientInfo}
    Transport->>Controller: handleRequest()
    Controller->>Controller: Create new session<br/>(server + transport)
    Controller-->>Client: {serverInfo, capabilities}<br/>+ mcp-session-id header

    Client->>Transport: POST notifications/initialized
    Note over Client,Transport: Session established

    Client->>Transport: POST tools/list<br/>mcp-session-id: xxx
    Transport->>Server: ListToolsRequest
    Server-->>Client: {tools: [list_content_types, search_content, write_content]}

    Client->>Transport: POST tools/call<br/>{name: "list_content_types", arguments: {}}
    Transport->>Server: CallToolRequest
    Server->>Tools: handleToolCall()
    Tools->>Tools: validateToolInput()
    Tools->>Strapi: listContentTypes(strapi)
    Strapi-->>Tools: content types + components
    Tools-->>Client: {content: [{type: "text", text: "..."}]}

    Client->>Transport: DELETE<br/>mcp-session-id: xxx
    Controller->>Controller: Close session
```

#### Session Management

Each MCP client gets its own isolated session with a unique server + transport pair:

- Sessions are created on the first `initialize` request
- Session ID is returned via the `mcp-session-id` response header
- Subsequent requests must include the `mcp-session-id` header
- Sessions expire after 4 hours
- Expired sessions are cleaned up probabilistically (~1% of requests)
- All sessions are closed on plugin destroy

#### MCP Tools

| MCP Tool Name | Shared Logic | Extra (MCP-specific) |
|---------------|-------------|---------------------|
| `list_content_types` | `listContentTypes()` | — |
| `search_content` | `searchContent()` | Output sanitization |
| `write_content` | `writeContent()` | Input + output sanitization |

The MCP tools add **sanitization** that the AI SDK chat tools don't have, because MCP operates via the content API (external), while the chat tools run in a trusted server context.

#### Validation

MCP tool inputs are validated via Zod schemas in `mcp/schemas/index.ts`:

```typescript
const ToolSchemas = {
  list_content_types: z.object({}),
  search_content: z.object({
    contentType: z.string().min(1),
    query: z.string().optional(),
    filters: z.record(z.string(), z.any()).optional(),
    // ... page, pageSize, sort, fields
  }),
  write_content: z.object({
    contentType: z.string().min(1),
    action: z.enum(['create', 'update']),
    documentId: z.string().optional(),
    data: z.record(z.string(), z.any()),
    status: z.enum(['draft', 'published']).optional(),
  }),
};
```

#### Connecting Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ai-sdk-local": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:1337/api/ai-sdk/mcp",
        "--header",
        "Authorization: Bearer YOUR_STRAPI_API_TOKEN"
      ]
    }
  }
}
```

---

## Admin Side

### Chat Interface

```mermaid
graph TB
    subgraph HomePage
        HP[HomePage.tsx<br/>Layout: Chat + Avatar]
    end

    subgraph Components
        CH[Chat.tsx<br/>Message list + input]
        AP[AvatarPanel.tsx<br/>Avatar container]
        AV[Avatar3D.tsx<br/>Three.js scene]
    end

    subgraph Hooks
        UC[useChat.ts<br/>SSE streaming + messages]
    end

    subgraph Context
        AAC[AvatarAnimationContext<br/>Current animation state]
    end

    HP --> CH
    HP --> AP
    AP --> AV
    CH --> UC
    UC -->|POST /admin/api/ai-sdk/chat| API[Admin API]
    UC -->|parse SSE stream| UC
    UC -->|detect triggerAnimation tool call| AAC
    AAC --> AV
```

**`useChat` hook:**
- Sends messages to `POST /admin/api/ai-sdk/chat` with admin JWT auth
- Parses the AI SDK UI Message Stream v1 protocol (SSE)
- Detects `tool-input-available` events for `triggerAnimation` and updates the animation context
- Manages message history, loading state, and error handling

### 3D Avatar

Built with raw Three.js (not @react-three/fiber — incompatible with Strapi's React 18).

```mermaid
graph TB
    AV[Avatar3D.tsx] --> R[Three.js Renderer]
    AV --> S[Scene]
    AV --> C[PerspectiveCamera]
    AV --> OC[OrbitControls]
    AV --> PM[PlaceholderModel.ts<br/>Procedural humanoid]
    AV --> AN[animations.ts<br/>8 animation factories]

    subgraph Animation Loop
        RAF[requestAnimationFrame]
        RAF --> |delta| ANIM[Current Animation.update]
        ANIM --> |done?| IDLE[Return to idle]
    end

    AAC[AvatarAnimationContext] -->|animation name| AV
    AV --> RAF
```

**Available animations:**

| Animation | Trigger | Description |
|-----------|---------|-------------|
| `idle` | Default | Subtle breathing, slight head sway |
| `speak` | Normal responses | Head nods, arm gestures |
| `wave` | Greetings | Right arm raises and oscillates |
| `nod` | Agreement | Head tilts forward/back |
| `think` | Pondering | Head tilts, arm to chin |
| `celebrate` | Success | Both arms up, body bounces |
| `shake` | Disagreement | Head rotates left-right |
| `spin` | On request | Full 360 rotation |

---

## Data Flow

### Chat Flow (Admin UI)

```mermaid
sequenceDiagram
    participant User as Admin User
    participant Chat as Chat Component
    participant Hook as useChat Hook
    participant API as POST /admin/api/ai-sdk/chat
    participant Service as service.chat()
    participant AI as AISDKManager → Claude
    participant Tools as AI SDK Tools
    participant Avatar as AvatarAnimationContext

    User->>Chat: Types message
    Chat->>Hook: sendMessage()
    Hook->>API: { messages }
    API->>Service: chat(messages)
    Service->>Service: convertToModelMessages()
    Service->>Service: createTools(strapi)
    Service->>AI: streamRaw({ messages, tools, system })

    AI->>AI: Claude decides to call triggerAnimation
    AI-->>Hook: tool-input-available: triggerAnimation("speak")
    Hook->>Avatar: setAnimation("speak")
    Avatar->>Avatar: Avatar starts speaking animation

    AI->>AI: Claude decides to call searchContent
    AI->>Tools: searchContent({ contentType: "api::article.article" })
    Tools-->>AI: { results: [...] }

    AI-->>Hook: text-delta: "Here are your articles..."
    Hook-->>Chat: Update message display

    Note over AI,Hook: Up to 6 tool-call rounds (stepCountIs(6))
```

### MCP Flow (Claude Desktop)

```mermaid
sequenceDiagram
    participant CD as Claude Desktop
    participant MCP as /api/ai-sdk/mcp
    participant Ctrl as MCP Controller
    participant Srv as MCP Server
    participant TH as Tool Handler
    participant Val as Schema Validator
    participant San as Sanitizer
    participant Logic as Shared Tool Logic
    participant Strapi as Strapi Documents API

    CD->>MCP: POST initialize
    Ctrl->>Ctrl: Create session (server + transport)
    MCP-->>CD: session-id + capabilities

    CD->>MCP: POST tools/call {name: "search_content", arguments: {...}}
    MCP->>Ctrl: handleRequest()
    Ctrl->>Srv: CallToolRequest
    Srv->>TH: handleToolCall(strapi, request)
    TH->>Val: validateToolInput("search_content", args)
    Val-->>TH: validated params
    TH->>Logic: searchContent(strapi, params)
    Logic->>Strapi: documents(uid).findMany()
    Strapi-->>Logic: raw results
    Logic-->>TH: { results, pagination }
    TH->>San: sanitizeOutput(strapi, uid, results)
    San-->>TH: sanitized results
    TH-->>CD: {content: [{type: "text", text: JSON.stringify(...)}]}
```

---

## Testing

Tests are in `server/tests/`:

| Script | Command | Description |
|--------|---------|-------------|
| `test:api` | `npm run test:api` | Tests `/ask` and `/ask-stream` endpoints |
| `test:mcp` | `npm run test:mcp` | Tests MCP initialize, list tools, call tool |
| `test:stream` | `npm run test:stream` | Tests SSE streaming |
| `test:chat` | `npm run test:chat` | Tests chat with UI message stream |

The MCP test (`test:mcp`) loads `STRAPI_API_TOKEN` from `server/.env` via `--env-file`.

---

## Key Patterns

### Zod v4 + AI SDK v6: Must Use `zodSchema()`

Raw `z.object({})` lacks the `jsonSchema` property that AI SDK needs. Always wrap:

```typescript
// Correct
inputSchema: zodSchema(z.object({ ... }))

// Wrong — causes "input_schema.type: Field required" from Anthropic API
inputSchema: z.object({ ... })
```

### Two Interfaces, One Logic

Tool business logic lives in `tool-logic/`. Both AI SDK tools and MCP tools import from there:

```
tool-logic/searchContent()     ← pure function, takes (strapi, params)
    ↑                    ↑
    |                    |
tools/search-content.ts    mcp/tools/search-content.ts
(AI SDK tool() wrapper)    (MCP handler + sanitization)
```

### MCP Adds Sanitization

MCP tools run via the content API (external access), so they sanitize inputs and outputs through `strapi.contentAPI.sanitize`. The AI SDK chat tools run in a trusted server context and skip this step.

### triggerAnimation is Admin-Only

The `triggerAnimation` tool is only included in the AI SDK chat tools (used by the admin UI). It is intentionally excluded from the MCP server since it controls a UI element that only exists in the Strapi admin panel.

### Three.js Without React Three Fiber

The 3D avatar uses raw Three.js with `useRef`/`useEffect` instead of `@react-three/fiber`. R3F's custom React reconciler is incompatible with Strapi's React 18, causing runtime errors. The plugin manages its own renderer, scene, camera, and `requestAnimationFrame` loop imperatively.
# fun-strapi-ai-plugin
