import { Application, Config } from '@cmmv/core';
import { DefaultAdapter } from '@cmmv/http';
import { MCPModule } from '../src/mcp.module';
import { MCPHandlers } from './mcp-handlers';

Config.assign({
	server: {
		port: 8766,
	},
});

Application.create({
	httpAdapter: DefaultAdapter,
	modules: [MCPModule],
	providers: [MCPHandlers],
});
