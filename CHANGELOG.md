# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.3.0](https://github.com/cmmv/cmmv-mcp/compare/v0.0.2...v0.3.0) (2025-01-08)

### ✨ Features

* **HTTP Server Integration**: Native integration with `@cmmv/server` to use the same port via `integrateWithHttp` configuration
* **StreamableHTTP Transport**: Implemented `StreamableHTTPServerTransport` for modern MCP communication with session management
* **Session Management**: Support for multiple concurrent MCP sessions with session ID tracking and cleanup
* **Legacy SSE Support**: Maintained backward compatibility with Server-Sent Events (`/sse`, `/messages`) routes
* **Configuration Options**: Added `integrateWithHttp` boolean flag to control standalone vs integrated mode
* **Health Endpoints**: Added `/mcp/health` and `/mcp/tools` endpoints for monitoring and debugging
* **CORS Support**: Enhanced CORS configuration for cross-origin requests with configurable middleware
* **DNS Rebinding Protection**: Configurable DNS rebinding protection (disabled for local development environments)

### 🔧 Technical Improvements

* **Hook Integration**: Implemented `@Hook(HooksType.onHTTPServerInit)` for seamless server integration
* **Transport Management**: Added static `transports` object for session-based transport management and cleanup
* **Error Handling**: Enhanced error handling with proper HTTP status codes (400, 500) and error messages
* **Logging**: Improved logging for session lifecycle (initialization, closure) and error tracking
* **Type Safety**: Enhanced TypeScript types with better null handling and union types
* **Route Organization**: Refactored route setup with `setupMCPRoutes()` and `integrateWithHTTPServer()` methods

### 📚 Documentation

* **README Updates**: Comprehensive documentation for both standalone and integrated modes with examples
* **Configuration Examples**: Added detailed examples for different transport types and integration scenarios
* **API Documentation**: Documented all new endpoints (`/mcp`, `/mcp/health`, `/mcp/tools`) and configuration options
* **Migration Guide**: Added guidance for upgrading from previous versions with breaking changes noted

### 🧪 Testing

* **Integration Tests**: Added 15 comprehensive tests for HTTP server integration (test/integration.spec.ts)
* **Session Management Tests**: Added tests for session lifecycle and transport management
* **Legacy Compatibility Tests**: Updated tests for HTTP transport (replacing SSE as default)
* **Configuration Tests**: Added tests for different configuration scenarios (standalone vs integrated)
* **Tool Registration Tests**: Added tests for new SDK API with `registerTool` method

### 🔄 Breaking Changes

* **Transport Default**: Changed default transport from `'sse'` to `'http'` (StreamableHTTP)
* **Response Format**: Updated tool handler responses to match MCP SDK expectations with structured content
* **Session Handling**: Modified session initialization to be compatible with Cursor and other MCP clients
* **API Changes**: Replaced `mcpServer.tool()` with `mcpServer.registerTool()` following new SDK API

### 🐛 Bug Fixes

* **Session ID Handling**: Fixed "Invalid or missing session ID" error for new session initialization
* **Response Format**: Fixed tool handler response format to include proper content structure array
* **CORS Headers**: Fixed CORS header handling for integrated mode with proper middleware setup
* **Transport Cleanup**: Fixed transport cleanup when sessions are closed to prevent memory leaks
* **DNS Protection**: Disabled DNS rebinding protection for localhost development

### 📦 Dependencies

* **@modelcontextprotocol/sdk**: Updated to latest version with StreamableHTTPServerTransport support
* **@cmmv/core**: Updated to latest version for hook system integration and Application.instance
* **@cmmv/server**: Updated to latest version for HTTP adapter compatibility
* **@cmmv/cors**: Added for enhanced CORS middleware support

### 🚀 Migration from 0.0.2

1. Update configuration to use `transport: 'http'` (default)
2. Add `integrateWithHttp: true` if you want to use the same port as your HTTP server
3. Update tool handlers to return `{ content: [...] }` format
4. Test session management with your MCP clients

---

## <small>0.0.2 (2025-03-31)</small>

### Bug Fixes & Updates

* fix: pnpm node-linker configuration ([1aee32d](https://github.com/cmmvio/cmmv-mcp/commit/1aee32d))
* fix: README documentation updates ([3406830](https://github.com/cmmvio/cmmv-mcp/commit/3406830))
* fix: README formatting corrections ([37c4fa1](https://github.com/cmmvio/cmmv-mcp/commit/37c4fa1))
* update: README improvements ([4e6cabe](https://github.com/cmmvio/cmmv-mcp/commit/4e6cabe))
* feat: first functional version with basic MCP support ([74ecfcc](https://github.com/cmmvio/cmmv-mcp/commit/74ecfcc))
* first commit: Initial project setup ([e0ee356](https://github.com/cmmvio/cmmv-mcp/commit/e0ee356))

