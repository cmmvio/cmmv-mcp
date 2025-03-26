import { Singleton, Service, Logger, Application } from '@cmmv/core';

@Service('module')
export class ModuleService extends Singleton {
    public logger: Logger = new Logger('ModuleService');

    public static async loadConfig(application: Application): Promise<void> {}
}
