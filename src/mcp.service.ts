import { ServerResponse, IncomingMessage } from 'http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import cmmv, { kResponseHeaders } from '@cmmv/server';
import cors from '@cmmv/cors';
import { CorsMiddleware } from '@cmmv/cors';

import { Singleton, Service, Config, Logger } from '@cmmv/core';

import { MCPRegistry } from './mcp.registry';

@Service('mcp')
export class MCPService extends Singleton {
	public static mcpServer: McpServer;
	public static transport: SSEServerTransport | StdioServerTransport | null =
		null;
	public static logger = new Logger('MCPService');
	public static server: any;

	public static async loadConfig(): Promise<void> {
		const port = Config.get<number>('mcp.port', 8765);
		const name = Config.get<string>('mcp.name', 'mcp');
		const version = Config.get<string>('mcp.version', '0.0.1');
		const transport = Config.get<string>('mcp.transport', 'sse');

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
		} else if (transport === 'sse') {
			MCPService.transport = null;

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
						type: Config.get<string>('mcp.transport', 'sse'),
						connected: MCPService.transport !== null,
						server_initialized: MCPService.mcpServer !== undefined,
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

			this.server.get('/sse', async (req, res) => {
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
			});

			this.server.post('/messages', async (req, res) => {
				console.log('to aki');
				if (
					MCPService.transport &&
					MCPService.transport instanceof SSEServerTransport
				) {
					console.log('to aki2');
					const result = await MCPService.transport.handlePostMessage(
						req.req,
						res.res,
					);

					res.json(result);
				} else {
					res.status(400).send({
						error: 'SSE transport not available',
					});
				}
			});

			this.server.listen({ host: '0.0.0.0', port }).then((server) => {
				MCPService.logger.log(
					`MCP Server running with SSE on http://localhost:${port}/sse`,
				);
			});
		}
	}

	public static async processHandlers() {
		MCPRegistry.getHandlers().forEach(async (handler) => {
			const [message, { schema, consumes }] = handler;

			for (const consume of consumes) {
				MCPService.mcpServer.tool(
					consume.handlerName,
					consume.schema,
					consume.cb,
				);
			}
		});
	}
}
