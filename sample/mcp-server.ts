import { Application, Config } from '@cmmv/core';
import { DefaultAdapter } from '@cmmv/http';
import { MCPModule } from '../src/mcp.module';
import { MCPHandlers } from './mcp-handlers';

Config.assign({
	mcp: {
		port: 8766,
		transport: 'http',
		name: 'cmmv-mcp-server',
		version: '1.0.0',
	},
});

Application.create({
	httpAdapter: DefaultAdapter,
	modules: [MCPModule],
	providers: [MCPHandlers],
});
