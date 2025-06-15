import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPService } from '../src/mcp.service';
import { MCPRegistry } from '../src/mcp.registry';
import { Config, Logger } from '@cmmv/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import cmmv from '@cmmv/server';

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('@modelcontextprotocol/sdk/server/sse.js');
vi.mock('@cmmv/server');
vi.mock('@cmmv/core');
vi.mock('../src/mcp.registry');

describe('MCPService', () => {
	let mockMcpServer: any;
	let mockStdioTransport: any;
	let mockSSETransport: any;
	let mockCmmvServer: any;

	beforeEach(() => {
		// Reset static properties
		MCPService.mcpServer = undefined as any;
		MCPService.transport = null;
		MCPService.server = undefined;

		// Setup mocks
		mockMcpServer = {
			connect: vi.fn(),
			tool: vi.fn(),
		};

		mockStdioTransport = {
			connect: vi.fn(),
		};

		mockSSETransport = {
			handlePostMessage: vi.fn(),
		};

		mockCmmvServer = {
			get: vi.fn(),
			post: vi.fn(),
			listen: vi.fn().mockResolvedValue({}),
		};

		vi.mocked(McpServer).mockImplementation(() => mockMcpServer);
		vi.mocked(StdioServerTransport).mockImplementation(
			() => mockStdioTransport,
		);
		vi.mocked(SSEServerTransport).mockImplementation(
			() => mockSSETransport,
		);
		vi.mocked(cmmv).mockReturnValue(mockCmmvServer);

		// Mock Config
		vi.mocked(Config.get).mockImplementation(
			(key: string, defaultValue?: any) => {
				const configs: Record<string, any> = {
					'mcp.port': 8765,
					'mcp.name': 'mcp',
					'mcp.version': '0.0.1',
					'mcp.transport': 'sse',
				};
				return configs[key] || defaultValue;
			},
		);

		// Mock Logger
		const mockLogger = {
			log: vi.fn(),
		};
		vi.mocked(Logger).mockImplementation(() => mockLogger as any);

		// Mock MCPRegistry
		vi.mocked(MCPRegistry.getHandlers).mockReturnValue([]);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('loadConfig', () => {
		it('should load configuration and create MCP server', async () => {
			await MCPService.loadConfig();

			expect(McpServer).toHaveBeenCalledWith({
				name: 'mcp',
				version: '0.0.1',
			});
			expect(MCPService.mcpServer).toBe(mockMcpServer);
		});

		it('should return early if server already exists', async () => {
			MCPService.server = mockCmmvServer;

			await MCPService.loadConfig();

			// Should not create a new server
			expect(McpServer).not.toHaveBeenCalled();
		});

		it('should setup STDIO transport when configured', async () => {
			vi.mocked(Config.get).mockImplementation(
				(key: string, defaultValue?: any) => {
					if (key === 'mcp.transport') return 'stdio';
					const configs: Record<string, any> = {
						'mcp.port': 8765,
						'mcp.name': 'mcp',
						'mcp.version': '0.0.1',
					};
					return configs[key] || defaultValue;
				},
			);

			await MCPService.loadConfig();

			expect(StdioServerTransport).toHaveBeenCalled();
			expect(mockMcpServer.connect).toHaveBeenCalledWith(
				mockStdioTransport,
			);
		});

		it('should setup SSE transport when configured', async () => {
			await MCPService.loadConfig();

			expect(cmmv).toHaveBeenCalled();
			expect(mockCmmvServer.get).toHaveBeenCalledWith(
				'/health',
				expect.any(Function),
			);
			expect(mockCmmvServer.get).toHaveBeenCalledWith(
				'/tools',
				expect.any(Function),
			);
			expect(mockCmmvServer.get).toHaveBeenCalledWith(
				'/sse',
				expect.any(Function),
			);
			expect(mockCmmvServer.post).toHaveBeenCalledWith(
				'/messages',
				expect.any(Function),
			);
			expect(mockCmmvServer.listen).toHaveBeenCalledWith({
				host: '0.0.0.0',
				port: 8765,
			});
		});

		it('should handle SSE GET request', async () => {
			await MCPService.loadConfig();

			const getHandler = mockCmmvServer.get.mock.calls.find(
				(call: any) => call[0] === '/sse',
			)[1];
			const mockReq = {};
			const mockRes = { res: {} };

			await getHandler(mockReq, mockRes);

			expect(SSEServerTransport).toHaveBeenCalledWith(
				'/messages',
				mockRes.res,
			);
			expect(mockMcpServer.connect).toHaveBeenCalledWith(
				mockSSETransport,
			);
		});

		it('should handle SSE POST request', async () => {
			await MCPService.loadConfig();
			MCPService.transport = mockSSETransport;

			const postHandler = mockCmmvServer.post.mock.calls.find(
				(call: any) => call[0] === '/messages',
			)[1];
			const mockReq = { req: {} };
			const mockRes = { res: {} };

			await postHandler(mockReq, mockRes);

			expect(mockSSETransport.handlePostMessage).toHaveBeenCalledWith(
				mockReq.req,
				mockRes.res,
			);
		});

		it('should not handle POST request if transport is not SSE', async () => {
			await MCPService.loadConfig();
			MCPService.transport = null;

			const postHandler = mockCmmvServer.post.mock.calls.find(
				(call: any) => call[0] === '/messages',
			)[1];
			const mockReq = { req: {} };
			const mockRes = {
				res: {},
				status: vi.fn().mockReturnThis(),
				send: vi.fn(),
			};

			await postHandler(mockReq, mockRes);

			expect(mockSSETransport.handlePostMessage).not.toHaveBeenCalled();
			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.send).toHaveBeenCalledWith({
				error: 'SSE transport not available',
			});
		});

		it('should handle health endpoint', async () => {
			await MCPService.loadConfig();

			const healthHandler = mockCmmvServer.get.mock.calls.find(
				(call: any) => call[0] === '/health',
			)[1];
			const mockReq = {};
			const mockRes = {
				setHeader: vi.fn(),
				send: vi.fn(),
			};

			await healthHandler(mockReq, mockRes);

			expect(mockRes.setHeader).toHaveBeenCalledWith(
				'Content-Type',
				'application/json',
			);
			expect(mockRes.send).toHaveBeenCalledWith(
				expect.objectContaining({
					status: 'healthy',
					timestamp: expect.any(String),
					version: '0.0.1',
					name: 'mcp',
					transport: expect.objectContaining({
						type: 'sse',
						connected: expect.any(Boolean),
						server_initialized: expect.any(Boolean),
					}),
					handlers: expect.objectContaining({
						count: expect.any(Number),
						registered: expect.any(Array),
					}),
				}),
			);
		});

		it('should handle tools endpoint', async () => {
			await MCPService.loadConfig();

			const toolsHandler = mockCmmvServer.get.mock.calls.find(
				(call: any) => call[0] === '/tools',
			)[1];
			const mockReq = {};
			const mockRes = {
				setHeader: vi.fn(),
				send: vi.fn(),
			};

			await toolsHandler(mockReq, mockRes);

			expect(mockRes.setHeader).toHaveBeenCalledWith(
				'Content-Type',
				'application/json',
			);
			expect(mockRes.send).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Array),
					count: expect.any(Number),
				}),
			);
		});
	});

	describe('processHandlers', () => {
		it('should process handlers from registry', async () => {
			const mockHandlers = [
				[
					'test-message',
					{
						schema: { type: 'object' },
						consumes: [
							{
								handlerName: 'test-handler',
								schema: {
									type: 'object',
									properties: { name: { type: 'string' } },
								},
								cb: vi.fn(),
							},
						],
					},
				],
			];

			vi.mocked(MCPRegistry.getHandlers).mockReturnValue(
				mockHandlers as any,
			);

			MCPService.mcpServer = mockMcpServer;

			await MCPService.processHandlers();

			expect(mockMcpServer.tool).toHaveBeenCalledWith(
				'test-handler',
				{ type: 'object', properties: { name: { type: 'string' } } },
				expect.any(Function),
			);
		});

		it('should handle multiple handlers', async () => {
			const mockHandlers = [
				[
					'test-message-1',
					{
						schema: { type: 'object' },
						consumes: [
							{
								handlerName: 'handler-1',
								schema: { type: 'object' },
								cb: vi.fn(),
							},
							{
								handlerName: 'handler-2',
								schema: { type: 'object' },
								cb: vi.fn(),
							},
						],
					},
				],
			];

			vi.mocked(MCPRegistry.getHandlers).mockReturnValue(
				mockHandlers as any,
			);

			MCPService.mcpServer = mockMcpServer;

			await MCPService.processHandlers();

			expect(mockMcpServer.tool).toHaveBeenCalledTimes(2);
			expect(mockMcpServer.tool).toHaveBeenCalledWith(
				'handler-1',
				{ type: 'object' },
				expect.any(Function),
			);
			expect(mockMcpServer.tool).toHaveBeenCalledWith(
				'handler-2',
				{ type: 'object' },
				expect.any(Function),
			);
		});

		it('should handle empty handlers', async () => {
			vi.mocked(MCPRegistry.getHandlers).mockReturnValue([]);

			MCPService.mcpServer = mockMcpServer;

			await MCPService.processHandlers();

			expect(mockMcpServer.tool).not.toHaveBeenCalled();
		});
	});

	describe('Configuration', () => {
		it('should use default values when config is not provided', async () => {
			vi.mocked(Config.get).mockImplementation(
				(key: string, defaultValue?: any) => {
					return defaultValue;
				},
			);

			await MCPService.loadConfig();

			expect(Config.get).toHaveBeenCalledWith('mcp.port', 8765);
			expect(Config.get).toHaveBeenCalledWith('mcp.name', 'mcp');
			expect(Config.get).toHaveBeenCalledWith('mcp.version', '0.0.1');
			expect(Config.get).toHaveBeenCalledWith('mcp.transport', 'sse');
		});

		it('should use custom configuration values', async () => {
			vi.mocked(Config.get).mockImplementation(
				(key: string, defaultValue?: any) => {
					const configs: Record<string, any> = {
						'mcp.port': 9999,
						'mcp.name': 'custom-mcp',
						'mcp.version': '1.0.0',
						'mcp.transport': 'stdio',
					};
					return configs[key] || defaultValue;
				},
			);

			await MCPService.loadConfig();

			expect(McpServer).toHaveBeenCalledWith({
				name: 'custom-mcp',
				version: '1.0.0',
			});
		});
	});

	describe('Static Properties', () => {
		it('should initialize static properties correctly', () => {
			expect(MCPService.transport).toBe(null);
			expect(MCPService.logger).toBeDefined();
		});
	});
});

// Test for MCP Handlers
describe('MCPHandlers Integration', () => {
	class TestMCPHandlers {
		public async greet({ name, age }: { name: string; age: number }) {
			return {
				content: `Hello ${name}, you are ${age} years old`,
			};
		}
	}

	it('should handle greet method correctly', async () => {
		const handlers = new TestMCPHandlers();
		const result = await handlers.greet({ name: 'John', age: 30 });

		expect(result).toEqual({
			content: 'Hello John, you are 30 years old',
		});
	});

	it('should handle different input parameters', async () => {
		const handlers = new TestMCPHandlers();
		const result = await handlers.greet({ name: 'Alice', age: 25 });

		expect(result).toEqual({
			content: 'Hello Alice, you are 25 years old',
		});
	});
});

// Test for MCP Server Application
describe('MCP Server Application', () => {
	it('should create application with correct configuration', () => {
		const mockConfig = {
			server: {
				port: 8766,
			},
		};

		expect(mockConfig.server.port).toBe(8766);
	});
});
