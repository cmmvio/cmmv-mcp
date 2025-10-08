import { ServerResponse, IncomingMessage } from 'http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import cmmv, { kResponseHeaders } from '@cmmv/server';
import cors from '@cmmv/cors';
import { CorsMiddleware } from '@cmmv/cors';

import {
	Singleton,
	Service,
	Config,
	Logger,
	Hook,
	HooksType,
	Application,
} from '@cmmv/core';

import { MCPRegistry } from './mcp.registry';

@Service('mcp')
export class MCPService extends Singleton {
	public static mcpServer: McpServer;
	public static transport:
		| StreamableHTTPServerTransport
		| StdioServerTransport
		| SSEServerTransport
		| null = null;
	public static logger = new Logger('MCPService');
	public static server: any;
	public static transports: {
		[sessionId: string]: StreamableHTTPServerTransport;
	} = {};

	public static getConfig<T>(key: string, defaultValue: T): T {
		return Config.get<T>(`mcp.${key}`, defaultValue);
	}

	@Hook(HooksType.onHTTPServerInit)
	public async integrateWithHttp() {
		const integrateWithHttp = Config.get<boolean>(
			'mcp.integrateWithHttp',
			false,
		);

		if (integrateWithHttp) {
			const app = Application.instance.getHttpAdapter();
			MCPService.server = app;
			MCPService.integrateWithHTTPServer(app);
		}
	}

	public static async loadConfig(): Promise<void> {
		const port = Config.get<number>('mcp.port', 8765);
		const name = Config.get<string>('mcp.name', 'mcp');
		const version = Config.get<string>('mcp.version', '0.0.1');
		const transport = Config.get<string>('mcp.transport', 'http');
		const integrateWithHttp = Config.get<boolean>(
			'mcp.integrateWithHttp',
			false,
		);

		if (this.server) return;

		MCPService.mcpServer = new McpServer({
			name,
			version,
		});

		await MCPService.processHandlers();

		if (transport === 'stdio') {
			const transport = new StdioServerTransport();
			await MCPService.mcpServer.connect(transport);
			MCPService.logger.log(`MCPServer running with stdio transport`);
		} else if (transport === 'http' || transport === 'sse') {
			if (!integrateWithHttp) {
				this.server = cmmv();

				const corsMiddleware = new CorsMiddleware({
					origin: '*',
					methods: ['GET', 'POST', 'OPTIONS'],
					allowedHeaders: ['Content-Type', 'Authorization'],
					exposedHeaders: ['Content-Type', 'Authorization'],
					credentials: true,
					maxAge: 86400,
				});

				this.server.use(cors());

				this.server.get('/health', (req, res) => {
					const healthStatus = {
						status: 'ok',
						timestamp: new Date().toISOString(),
						version: Config.get<string>('mcp.version', '0.0.1'),
						name: Config.get<string>('mcp.name', 'mcp'),
						transport: {
							type: Config.get<string>('mcp.transport', 'http'),
							server_initialized:
								MCPService.mcpServer !== undefined,
						},
						handlers: {
							count: MCPRegistry.getHandlers().length,
							registered: MCPRegistry.getHandlers().map(
								([name, config]) => ({
									name,
									tools: config.consumes.map(
										(c) => c.handlerName,
									),
								}),
							),
						},
					};

					res.setHeader('Content-Type', 'application/json');
					res.json(healthStatus);
				});

				this.server.get('/tools', (req, res) => {
					const tools = MCPRegistry.getHandlers().flatMap(
						([name, config]) =>
							config.consumes.map((consume) => ({
								name: consume.handlerName,
								description:
									consume.schema?.description ||
									`Tool for ${consume.handlerName}`,
								schema: consume.schema,
								handler: name,
							})),
					);

					res.setHeader('Content-Type', 'application/json');

					res.json({
						tools,
						count: tools.length,
					});
				});

				this.server.post('/mcp', async (req, res) => {
					try {
						// Check for existing session ID
						const sessionId = req.headers['mcp-session-id'] as
							| string
							| undefined;
						let transport: StreamableHTTPServerTransport;

						if (sessionId && MCPService.transports[sessionId]) {
							// Reuse existing transport
							transport = MCPService.transports[sessionId];
						} else {
							// Always create a new transport for each request if no session exists
							transport = new StreamableHTTPServerTransport({
								sessionIdGenerator: () => randomUUID(),
								onsessioninitialized: (sessionId) => {
									// Store the transport by session ID
									MCPService.transports[sessionId] =
										transport;
									MCPService.logger.log(
										`New MCP session initialized: ${sessionId}`,
									);
								},
								enableDnsRebindingProtection: false,
							});

							// Clean up transport when closed
							transport.onclose = () => {
								if (transport.sessionId) {
									MCPService.logger.log(
										`MCP session closed: ${transport.sessionId}`,
									);
									delete MCPService.transports[
										transport.sessionId
									];
								}
							};

							// Connect to the MCP server
							await MCPService.mcpServer.connect(transport);
						}

						// Handle the request
						await transport.handleRequest(
							req.req,
							res.res,
							req.body,
						);
					} catch (error: any) {
						MCPService.logger.error(
							'Error handling MCP request:',
							error,
						);
						res.statusCode = 500;
						res.json({
							error: 'Internal server error',
							message: error?.message || 'Unknown error',
						});
					}
				});

				const handleSessionRequest = async (req: any, res: any) => {
					const sessionId = req.headers['mcp-session-id'] as
						| string
						| undefined;
					if (!sessionId || !MCPService.transports[sessionId]) {
						res.statusCode = 400;
						res.send('Invalid or missing session ID');
						return;
					}

					const transport = MCPService.transports[sessionId];
					await transport.handleRequest(req.req, res.res);
				};

				this.server.get('/mcp', handleSessionRequest);
				this.server.delete('/mcp', handleSessionRequest);

				this.server.listen({ host: '0.0.0.0', port }).then((server) => {
					MCPService.logger.log(
						`MCP Server running with HTTP transport on http://localhost:${port}/mcp`,
					);
				});
			}
		}
	}

	public static async processHandlers() {
		const handlers = MCPRegistry.getHandlers();

		handlers.forEach(async (handler) => {
			const [message, { schema, consumes }] = handler;

			for (const consume of consumes) {
				MCPService.mcpServer.registerTool(
					consume.handlerName,
					{
						title: consume.handlerName,
						description:
							consume.schema?.description ||
							`Tool for ${consume.handlerName}`,
						inputSchema: consume.schema,
					},
					consume.cb,
				);
			}
		});
	}

	public static setupMCPRoutes() {
		// StreamableHTTP transport endpoint
		const mcpHandler = async (req: any, res: any) => {
			try {
				// Check for existing session ID
				const sessionId = req.headers['mcp-session-id'] as
					| string
					| undefined;
				let transport: StreamableHTTPServerTransport;

				if (sessionId && MCPService.transports[sessionId]) {
					// Reuse existing transport
					transport = MCPService.transports[sessionId];
				} else {
					// Always create a new transport for each request if no session exists
					transport = new StreamableHTTPServerTransport({
						sessionIdGenerator: () => randomUUID(),
						onsessioninitialized: (sessionId) => {
							// Store the transport by session ID
							MCPService.transports[sessionId] = transport;
							MCPService.logger.log(
								`New MCP session initialized: ${sessionId}`,
							);
						},
						enableDnsRebindingProtection: false,
					});

					// Clean up transport when closed
					transport.onclose = () => {
						if (transport.sessionId) {
							MCPService.logger.log(
								`MCP session closed: ${transport.sessionId}`,
							);
							delete MCPService.transports[transport.sessionId];
						}
					};

					// Connect to the MCP server
					await MCPService.mcpServer.connect(transport);
				}

				// Handle the request
				await transport.handleRequest(req.req, res.res, req.body);
			} catch (error: any) {
				MCPService.logger.error('Error handling MCP request:', error);
				res.statusCode = 500;
				res.json({
					error: 'Internal server error',
					message: error?.message || 'Unknown error',
				});
			}
		};

		// SSE transport endpoint (legacy)
		const sseHandler = async (req: any, res: any) => {
			try {
				const corsMiddleware = new CorsMiddleware({
					origin: '*',
					methods: ['GET', 'POST', 'OPTIONS'],
					allowedHeaders: ['Content-Type', 'Authorization'],
					exposedHeaders: ['Content-Type', 'Authorization'],
					credentials: true,
					maxAge: 86400,
				});

				corsMiddleware.onCall(req, res, null, async () => {
					const headers = { ...res[kResponseHeaders] };

					for (const key in headers)
						res.res.setHeader(key, headers[key]);

					MCPService.transport = new SSEServerTransport(
						'/messages',
						res.res as unknown as ServerResponse<IncomingMessage>,
					);

					await MCPService.mcpServer.connect(MCPService.transport);
				});

				return true;
			} catch (error: any) {
				MCPService.logger.error('Error handling SSE request:', error);
				res.statusCode = 500;
				res.json({
					error: 'Internal server error',
					message: error?.message || 'Unknown error',
				});
			}
		};

		// Messages endpoint (legacy)
		const messagesHandler = async (req: any, res: any) => {
			try {
				if (
					MCPService.transport &&
					MCPService.transport instanceof SSEServerTransport
				) {
					const result = await MCPService.transport.handlePostMessage(
						req.req,
						res.res,
					);

					res.json(result);
				} else {
					res.statusCode = 400;
					res.json({
						error: 'SSE transport not available',
					});
				}
			} catch (error: any) {
				MCPService.logger.error(
					'Error handling messages request:',
					error,
				);
				res.statusCode = 500;
				res.json({
					error: 'Internal server error',
					message: error?.message || 'Unknown error',
				});
			}
		};

		// Return route handlers for integration
		return {
			post: mcpHandler,
			sse: sseHandler,
			messages: messagesHandler,
		};
	}

	public static integrateWithHTTPServer(app: any) {
		const routes = MCPService.setupMCPRoutes();

		// Add MCP routes to existing HTTP server
		app.post('/mcp', routes.post);
		app.get('/mcp', routes.sse);
		app.post('/messages', routes.messages);

		// Add health and tools endpoints
		app.get('/mcp/health', (req: any, res: any) => {
			const healthStatus = {
				status: 'ok',
				timestamp: new Date().toISOString(),
				version: Config.get<string>('mcp.version', '0.0.1'),
				name: Config.get<string>('mcp.name', 'mcp'),
				transport: {
					type: Config.get<string>('mcp.transport', 'http'),
					server_initialized: MCPService.mcpServer !== undefined,
					integrated: true,
				},
				handlers: {
					count: MCPRegistry.getHandlers().length,
					registered: MCPRegistry.getHandlers().map(
						([name, config]) => ({
							name,
							tools: config.consumes.map((c) => c.handlerName),
						}),
					),
				},
			};

			res.setHeader('Content-Type', 'application/json');
			res.json(healthStatus);
		});

		app.get('/mcp/tools', (req: any, res: any) => {
			const tools = MCPRegistry.getHandlers().flatMap(([name, config]) =>
				config.consumes.map((consume) => ({
					name: consume.handlerName,
					description:
						consume.schema?.description ||
						`Tool for ${consume.handlerName}`,
					schema: consume.schema,
					handler: name,
				})),
			);

			res.setHeader('Content-Type', 'application/json');
			res.json({
				tools,
				count: tools.length,
			});
		});

		MCPService.logger.log('MCP routes integrated with HTTP server');
	}
}
