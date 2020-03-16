export type info = string | {
    url: string,
    uri?: string,
    method?: 'GET' | 'POST',
    form?: object,
    json?: object,
    body?: string | Buffer,
    contentType?: string,
    contentLength?: number,
    queryString?: string
}

export type request = {
    info: info,
    cb: CallableFunction
}