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

In your main file, include the `MCPModule` and configure your application:

```ts
import { Application, Config } from '@cmmv/core';
import { DefaultAdapter, DefaultHTTPModule } from '@cmmv/http';
import { MCPModule } from '@cmmv/mcp';
import { MCPHandlers } from './mcp-handlers';

Application.create({
    httpAdapter: DefaultAdapter,
    modules: [MCPModule],
    providers: [MCPHandlers],
});
```

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
