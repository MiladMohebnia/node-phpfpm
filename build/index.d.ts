import { configuration } from "./configuration.type";
import { info } from "./request.type";
export declare class PHPFPM {
    private configuration;
    private ready;
    private client;
    private queue;
    constructor(configuration?: configuration);
    run(info: info, cb: CallableFunction): void;
    private clearQueue;
}
