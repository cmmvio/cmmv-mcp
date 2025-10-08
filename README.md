<p align="center">
  <a href="https://cmmv.io/" target="blank"><img src="https://raw.githubusercontent.com/cmmvio/docs.cmmv.io/main/public/assets/logo_CMMV2_icon.png" width="300" alt="CMMV Logo" /></a>
</p>
<p align="center">Contract-Model-Model-View (CMMV) <br/> Building scalable and modular applications using contracts.</p>
<p align="center">
    <a href="https://www.npmjs.com/package/@cmmv/mcp"><img src="https://img.shields.io/npm/v/@cmmv/mcp.svg" alt="NPM Version" /></a>
    <a href="https://github.com/cmmvio/cmmv/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@cmmv/mcp.svg" alt="Package License" /></a>
</p>

<p align="center">
  <a href="https://cmmv.io">Documentation</a> &bull;
  <a href="https://github.com/cmmvio/cmmv/issues">Report Issue</a>
</p>

## Description

The `@cmmv/mcp` module implements the Model Context Protocol (MCP) for CMMV applications, allowing standardized interactions between LLMs (Large Language Models) and your application. MCP provides a structured interface for defining tools usable by AI models in a standard format.

## Features

- **LLM Integration**: Facilitates bidirectional communication between your application and language models.
- **Flexible Transport**: Supports transport via HTTP (StreamableHTTP), SSE, or Standard I/O.
- **API Decorator-Based**: Intuitive decorators like `@MCPTool` to register tools.
- **Validation with Zod**: Input schema validation using Zod.
- **Connection Management**: Robust implementation for handling multiple concurrent connections.
- **Modern SDK**: Uses the latest @modelcontextprotocol/sdk with StreamableHTTPServerTransport.
- **HTTP Server Integration**: Can integrate with existing CMMV HTTP server or run standalone.
- **Legacy SSE Support**: Maintains compatibility with SSE endpoints (`/sse`, `/messages`).

## Installation

Install `@cmmv/mcp` via pnpm:

```bash
$ pnpm add @cmmv/mcp
```

## Configuration

Configure the MCP module in your `.cmmv.config.cjs` or using `ConfigSchema`:

```ts
import { ConfigSchema } from '@cmmv/core';

export const MCPConfig: ConfigSchema = {
  mcp: {
    name: {
      type: 'string',
      required: true,
      default: 'mcp',
    },
    version: {
      type: 'string',
      required: true,
      default: '0.0.1',
    },
    port: {
      type: 'number',
      required: true,
      default: 8765,
    },
    transport: {
      type: 'string',
      required: true,
      default: 'http', // 'http', 'sse' or 'stdio'
    },
    integrateWithHttp: {
      type: 'boolean',
      required: false,
      default: false, // Integrate with existing HTTP server
    },
    jwtSecret: {
      type: 'string',
      required: true,
      default: 'your-secret-key',
    },
    pingInterval: {
      type: 'number',
      required: true,
      default: 30000,
    },
    connectionTimeout: {
      type: 'number',
      required: true,
      default: 300000,
    },
  },
};
```

## Setting Up the Application

### Standalone Mode (Default)

In your main file, include the `MCPModule` and configure your application:

```ts
import { Application, Config } from '@cmmv/core';
import { DefaultAdapter, DefaultHTTPModule } from '@cmmv/http';
import { MCPModule } from '@cmmv/mcp';
import { MCPHandlers } from './mcp-handlers';

Config.assign({
    mcp: {
        port: 8766,
        transport: 'http',
        name: 'cmmv-mcp-server',
        version: '1.0.0',
        integrateWithHttp: false, // Standalone mode
    },
});

Application.create({
    httpAdapter: DefaultAdapter,
    modules: [MCPModule],
    providers: [MCPHandlers],
});
```

### Integrated Mode (Same Port as HTTP Server)

To integrate MCP with your existing HTTP server:

```ts
import { Application, Config } from '@cmmv/core';
import { DefaultAdapter, DefaultHTTPModule } from '@cmmv/http';
import { MCPModule } from '@cmmv/mcp';
import { MCPHandlers } from './mcp-handlers';

Config.assign({
    mcp: {
        port: 3000, // Same port as your HTTP server
        transport: 'http',
        name: 'cmmv-mcp-server',
        version: '1.0.0',
        integrateWithHttp: true, // Integrate with existing HTTP server
    },
});

Application.create({
    httpAdapter: DefaultAdapter,
    modules: [MCPModule],
    providers: [MCPHandlers],
});
```

When `integrateWithHttp: true`, the MCP routes will be added to your existing HTTP server:
- `POST /mcp` - StreamableHTTP transport
- `GET /mcp` - SSE transport (legacy)
- `POST /messages` - Messages endpoint (legacy)
- `GET /mcp/health` - Health check
- `GET /mcp/tools` - List available tools

## Creating MCP Tool Handlers

Use the `@MCPTool` decorator to register tools callable by LLMs:

```ts
import { MCPTool, z } from '@cmmv/mcp';

export class MCPHandlers {
    @MCPTool('greet', {
        name: z.string(),
        age: z.number(),
    })
    public async greet({ name, age }: { name: string; age: number }) {
        return {
            content: `Hello \${name}, you are \${age} years old`,
        };
    }
}
```

## Using the MCP Client

The MCP client can connect to your server using the HTTP endpoint:

```bash
curl -X POST http://localhost:8765/mcp \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "greet",
      "arguments": {
        "name": "John",
        "age": 30
      }
    }
  }'
```

### Health Check

You can check the server health:

```bash
curl http://localhost:8765/health
```

### List Available Tools

You can list all available tools:

```bash
curl http://localhost:8765/tools
```

## Decorators

### `@MCPTool(name: string, schema: Record<string, z.ZodSchema>)`

Registers a method as an MCP tool with a name and validation schema.

## Best Practices

* **Define Schemas Clearly**: Use Zod schemas to clearly define parameters for each tool.
* **Provide Meaningful Responses**: Return structured and helpful responses for LLMs.
* **Handle Errors Gracefully**: Implement robust error handling in your handlers.
* **Security First**: Consider using JWT for public endpoints.
* **Performance**: Use timeouts and keep handlers lightweight and fast.
