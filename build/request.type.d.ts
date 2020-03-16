/// <reference types="node" />
export declare type info = string | {
    url: string;
    uri?: string;
    method?: 'GET' | 'POST';
    form?: object;
    json?: object;
    body?: string | Buffer;
    contentType?: string;
    contentLength?: number;
    queryString?: string;
};
export declare type request = {
    info: info;
    cb: CallableFunction;
};
