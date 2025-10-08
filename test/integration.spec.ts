import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPService } from '../src/mcp.service';
import { MCPRegistry } from '../src/mcp.registry';
import { Config, Logger, Application } from '@cmmv/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import cmmv from '@cmmv/server';

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js');
vi.mock('@cmmv/server');
vi.mock('@cmmv/core');
vi.mock('../src/mcp.registry');

describe('MCPService - HTTP Integration', () => {
	let mockMcpServer: any;
	let mockStreamableTransport: any;
	let mockCmmvServer: any;
	let mockApplication: any;

	beforeEach(() => {
		// Reset static properties
		MCPService.mcpServer = undefined as any;
		MCPService.transport = null;
		MCPService.server = undefined;
		MCPService.transports = {};

		// Setup mocks
		mockMcpServer = {
			connect: vi.fn(),
			registerTool: vi.fn(),
		};

		mockStreamableTransport = {
			handleRequest: vi.fn(),
			sessionId: 'test-session-id',
			onclose: null,
		};

		mockCmmvServer = {
			get: vi.fn(),
			post: vi.fn(),
			delete: vi.fn(),
			use: vi.fn(),
			listen: vi.fn().mockResolvedValue({}),
		};

		mockApplication = {
			getHttpAdapter: vi.fn().mockReturnValue(mockCmmvServer),
		};

		vi.mocked(McpServer).mockImplementation(() => mockMcpServer);
		vi.mocked(StreamableHTTPServerTransport).mockImplementation(
			() => mockStreamableTransport,
		);
		vi.mocked(cmmv).mockReturnValue(mockCmmvServer);
		Object.defineProperty(Application, 'instance', {
			get: () => mockApplication,
			configurable: true,
		});

		// Mock Config
		vi.mocked(Config.get).mockImplementation(
			(key: string, defaultValue?: any) => {
				const configs: Record<string, any> = {
					'mcp.port': 8766,
					'mcp.name': 'cmmv-mcp',
					'mcp.version': '0.3.0',
					'mcp.transport': 'http',
					'mcp.integrateWithHttp': false,
				};
				return configs[key] ?? defaultValue;
			},
		);

		// Mock Logger
		const mockLogger = {
			log: vi.fn(),
			error: vi.fn(),
		};
		vi.mocked(Logger).mockImplementation(() => mockLogger as any);

		// Mock MCPRegistry
		vi.mocked(MCPRegistry.getHandlers).mockReturnValue([]);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('StreamableHTTP Transport', () => {
		it('should create StreamableHTTP transport on POST /mcp', async () => {
			await MCPService.loadConfig();

			const postHandler = mockCmmvServer.post.mock.calls.find(
				(call: any) => call[0] === '/mcp',
			)?.[1];

			expect(postHandler).toBeDefined();

			const mockReq = {
				req: {},
				headers: {},
				body: {},
			};
			const mockRes = {
				res: {},
				statusCode: 200,
				json: vi.fn(),
			};

			await postHandler(mockReq, mockRes);

			expect(StreamableHTTPServerTransport).toHaveBeenCalled();
			expect(mockMcpServer.connect).toHaveBeenCalledWith(
				mockStreamableTransport,
			);
		});

		it('should reuse existing transport with session ID', async () => {
			await MCPService.loadConfig();

			const sessionId = 'existing-session';
			MCPService.transports[sessionId] = mockStreamableTransport;

			const postHandler = mockCmmvServer.post.mock.calls.find(
				(call: any) => call[0] === '/mcp',
			)?.[1];

			const mockReq = {
				req: {},
				headers: { 'mcp-session-id': sessionId },
				body: {},
			};
			const mockRes = {
				res: {},
				statusCode: 200,
				json: vi.fn(),
			};

			await postHandler(mockReq, mockRes);

			expect(mockStreamableTransport.handleRequest).toHaveBeenCalledWith(
				mockReq.req,
				mockRes.res,
				mockReq.body,
			);
		});

		it('should handle GET /mcp for session requests', async () => {
			await MCPService.loadConfig();

			const sessionId = 'test-session';
			MCPService.transports[sessionId] = mockStreamableTransport;

			const getHandler = mockCmmvServer.get.mock.calls.find(
				(call: any) => call[0] === '/mcp',
			)?.[1];

			expect(getHandler).toBeDefined();

			const mockReq = {
				req: {},
				headers: { 'mcp-session-id': sessionId },
			};
			const mockRes = {
				res: {},
				statusCode: 200,
				send: vi.fn(),
			};

			await getHandler(mockReq, mockRes);

			expect(mockStreamableTransport.handleRequest).toHaveBeenCalledWith(
				mockReq.req,
				mockRes.res,
			);
		});

		it('should handle DELETE /mcp for session termination', async () => {
			await MCPService.loadConfig();

			const sessionId = 'test-session';
			MCPService.transports[sessionId] = mockStreamableTransport;

			const deleteHandler = mockCmmvServer.delete.mock.calls.find(
				(call: any) => call[0] === '/mcp',
			)?.[1];

			expect(deleteHandler).toBeDefined();

			const mockReq = {
				req: {},
				headers: { 'mcp-session-id': sessionId },
			};
			const mockRes = {
				res: {},
				statusCode: 200,
				send: vi.fn(),
			};

			await deleteHandler(mockReq, mockRes);

			expect(mockStreamableTransport.handleRequest).toHaveBeenCalledWith(
				mockReq.req,
				mockRes.res,
			);
		});

		it('should return 400 for invalid session ID on GET', async () => {
			await MCPService.loadConfig();

			const getHandler = mockCmmvServer.get.mock.calls.find(
				(call: any) => call[0] === '/mcp',
			)?.[1];

			const mockReq = {
				req: {},
				headers: { 'mcp-session-id': 'invalid-session' },
			};
			const mockRes = {
				res: {},
				statusCode: 200,
				send: vi.fn(),
			};

			await getHandler(mockReq, mockRes);

			expect(mockRes.statusCode).toBe(400);
			expect(mockRes.send).toHaveBeenCalledWith(
				'Invalid or missing session ID',
			);
		});
	});

	describe('Integrated Mode', () => {
		beforeEach(() => {
			vi.mocked(Config.get).mockImplementation(
				(key: string, defaultValue?: any) => {
					const configs: Record<string, any> = {
						'mcp.port': 3000,
						'mcp.name': 'cmmv-mcp',
						'mcp.version': '0.3.0',
						'mcp.transport': 'http',
						'mcp.integrateWithHttp': true,
					};
					return configs[key] ?? defaultValue;
				},
			);
		});

		it('should integrate routes with existing HTTP server', async () => {
			const service = new MCPService();
			await service.integrateWithHttp();

			expect(mockApplication.getHttpAdapter).toHaveBeenCalled();
			expect(mockCmmvServer.post).toHaveBeenCalledWith(
				'/mcp',
				expect.any(Function),
			);
			expect(mockCmmvServer.get).toHaveBeenCalledWith(
				'/mcp',
				expect.any(Function),
			);
			expect(mockCmmvServer.post).toHaveBeenCalledWith(
				'/messages',
				expect.any(Function),
			);
			expect(mockCmmvServer.get).toHaveBeenCalledWith(
				'/mcp/health',
				expect.any(Function),
			);
			expect(mockCmmvServer.get).toHaveBeenCalledWith(
				'/mcp/tools',
				expect.any(Function),
			);
		});

		it('should not integrate if flag is false', async () => {
			vi.mocked(Config.get).mockImplementation(
				(key: string, defaultValue?: any) => {
					if (key === 'mcp.integrateWithHttp') return false;
					return defaultValue;
				},
			);

			const service = new MCPService();
			await service.integrateWithHttp();

			expect(mockApplication.getHttpAdapter).not.toHaveBeenCalled();
		});
	});

	describe('Session Management', () => {
		it('should store transport by session ID', async () => {
			await MCPService.loadConfig();

			const postHandler = mockCmmvServer.post.mock.calls.find(
				(call: any) => call[0] === '/mcp',
			)?.[1];

			// Mock StreamableHTTPServerTransport to call onsessioninitialized
			const sessionId = 'new-session-id';
			let capturedCallback: ((id: string) => void) | null = null;

			vi.mocked(StreamableHTTPServerTransport).mockImplementation(
				(options: any) => {
					capturedCallback = options.onsessioninitialized;
					const transport = {
						...mockStreamableTransport,
						sessionId,
						handleRequest: vi.fn(),
						onclose: null,
					};
					// Simulate session initialization
					if (capturedCallback) {
						capturedCallback(sessionId);
					}
					return transport as any;
				},
			);

			const mockReq = {
				req: {},
				headers: {},
				body: {},
			};
			const mockRes = {
				res: {},
				statusCode: 200,
				json: vi.fn(),
			};

			await postHandler(mockReq, mockRes);

			// The transport should be stored
			expect(MCPService.transports).toHaveProperty(sessionId);
		});

		it('should cleanup transport on close', async () => {
			await MCPService.loadConfig();

			const postHandler = mockCmmvServer.post.mock.calls.find(
				(call: any) => call[0] === '/mcp',
			)?.[1];

			const mockReq = {
				req: {},
				headers: {},
				body: {},
			};
			const mockRes = {
				res: {},
				statusCode: 200,
				json: vi.fn(),
			};

			await postHandler(mockReq, mockRes);

			// Simulate transport close
			const sessionId = 'test-session';
			mockStreamableTransport.sessionId = sessionId;
			MCPService.transports[sessionId] = mockStreamableTransport;

			if (mockStreamableTransport.onclose) {
				mockStreamableTransport.onclose();
			}

			// Should not have the session anymore
			expect(MCPService.transports[sessionId]).toBeUndefined();
		});
	});

	describe('Health and Tools Endpoints', () => {
		it('should handle /mcp/health endpoint', async () => {
			await MCPService.loadConfig();
			MCPService.integrateWithHTTPServer(mockCmmvServer);

			const healthHandler = mockCmmvServer.get.mock.calls.find(
				(call: any) => call[0] === '/mcp/health',
			)?.[1];

			expect(healthHandler).toBeDefined();

			const mockReq = {};
			const mockRes = {
				setHeader: vi.fn(),
				json: vi.fn(),
			};

			await healthHandler(mockReq, mockRes);

			expect(mockRes.setHeader).toHaveBeenCalledWith(
				'Content-Type',
				'application/json',
			);
			expect(mockRes.json).toHaveBeenCalledWith(
				expect.objectContaining({
					status: 'ok',
					timestamp: expect.any(String),
					version: expect.any(String),
					name: expect.any(String),
					transport: expect.objectContaining({
						type: expect.any(String),
						server_initialized: expect.any(Boolean),
						integrated: true,
					}),
					handlers: expect.objectContaining({
						count: expect.any(Number),
						registered: expect.any(Array),
					}),
				}),
			);
		});

		it('should handle /mcp/tools endpoint', async () => {
			await MCPService.loadConfig();
			MCPService.integrateWithHTTPServer(mockCmmvServer);

			const toolsHandler = mockCmmvServer.get.mock.calls.find(
				(call: any) => call[0] === '/mcp/tools',
			)?.[1];

			expect(toolsHandler).toBeDefined();

			const mockReq = {};
			const mockRes = {
				setHeader: vi.fn(),
				json: vi.fn(),
			};

			await toolsHandler(mockReq, mockRes);

			expect(mockRes.setHeader).toHaveBeenCalledWith(
				'Content-Type',
				'application/json',
			);
			expect(mockRes.json).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Array),
					count: expect.any(Number),
				}),
			);
		});
	});

	describe('Tool Registration', () => {
		it('should register tools with new SDK API', async () => {
			const mockHandlers = [
				[
					'test-message',
					{
						schema: { type: 'object' },
						consumes: [
							{
								handlerName: 'test-tool',
								schema: {
									description: 'Test tool',
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

			expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
				'test-tool',
				{
					title: 'test-tool',
					description: 'Test tool',
					inputSchema: expect.objectContaining({
						type: 'object',
						properties: { name: { type: 'string' } },
					}),
				},
				expect.any(Function),
			);
		});
	});

	describe('Error Handling', () => {
		it('should handle errors in POST /mcp endpoint', async () => {
			await MCPService.loadConfig();

			const postHandler = mockCmmvServer.post.mock.calls.find(
				(call: any) => call[0] === '/mcp',
			)?.[1];

			mockStreamableTransport.handleRequest.mockRejectedValue(
				new Error('Test error'),
			);

			const mockReq = {
				req: {},
				headers: {},
				body: {},
			};
			const mockRes = {
				res: {},
				statusCode: 200,
				json: vi.fn(),
			};

			await postHandler(mockReq, mockRes);

			expect(mockRes.statusCode).toBe(500);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: 'Internal server error',
				message: expect.any(String),
			});
		});
	});

	describe('Configuration', () => {
		it('should not create server if already exists', async () => {
			MCPService.server = mockCmmvServer;

			await MCPService.loadConfig();

			expect(cmmv).not.toHaveBeenCalled();
		});

		it('should use HTTP transport by default', async () => {
			vi.mocked(Config.get).mockImplementation(
				(key: string, defaultValue?: any) => {
					return defaultValue;
				},
			);

			await MCPService.loadConfig();

			expect(Config.get).toHaveBeenCalledWith('mcp.transport', 'http');
		});
	});
});
