import { configuration } from "./configuration.type";
import { request, info } from "./request.type";

export class PHPFPM {
    private configuration: configuration = {
        host: '127.0.0.1',
        port: 9000,
        documentRoot: '',
        skipCheckServer: true,
        environmentVariables: {}
    }
    private ready: boolean = false;
    private client: any;
    private queue: request[] = [];

    constructor(configuration: configuration = {}) {
        this.configuration = { ...this.configuration, ...configuration };

        // fixing the document root
        if (this.configuration.documentRoot?.substring(this.configuration.documentRoot.length - 1) == "/") {
            this.configuration.documentRoot = this.configuration.documentRoot.substring(0, this.configuration.documentRoot.length - 1);
        }

        this.client = require('fastcgi-client')(this.configuration);
        this.client.on('ready', () => {
            this.ready = true;
            this.clearQueue();
        });
    }

    run(info: info, cb: CallableFunction) {

        // check if request info is just a string then build info object
        if (typeof info === 'string') {
            info = {
                url: info,
                uri: info,
            }
        }

        // if there is no uri then add to info object
        if (!info.uri) {
            info.uri = info.url;
        }

        // if there is no method then default is get method
        if (!info.method) {
            info.method = info.body ? "POST" : "GET";
        }


        // if connection to php-fpm is not ready then queue the request
        // it will start as soon as the connection made
        if (!this.ready) {
            this.queue.push({ info: info, cb: cb });

            // there's no need to continue .. this method will be run
            // as soon as connection php-fpm is ready
            return;
        }

        // if it's form object request and with get request
        // we have to build URL and if it's post we have to
        // create body.
        if (info.form) {
            if (info.method != 'GET') {
                info.body = require('urlencode-for-php')(info.form);
                info.method = 'POST';
            } else {
                info.body = '';
                var qs = require('urlencode-for-php')(info.form);;
                info.url += (info.url.indexOf('?') === -1) ? '?' + qs : '&' + qs;
            }
        } else {

            // if there's no form data we go for json body .. 
            // remember form request are on priority compare to
            // json requests
            if (info.json) {
                info.body = JSON.stringify(info.json);
                info.method = 'POST';
                info.contentType = 'application/json';
            }
        }

        // if method is POST, preparing request
        if (info.method == 'POST') {
            !info.body && (info.body = '');
            if (typeof info.body === 'string') {
                info.body = new Buffer(info.body, 'utf8');
            }
            !info.contentType && (info.contentType = 'application/x-www-form-urlencoded');
            !info.contentLength && (info.contentLength = info.body.length);
        }

        // creating queryString for the request
        if (info.url.match(/\?/)) {
            let ms = info.url.match(/^([^\?]+)\?(.*)$/);
            if (ms != null) {
                info.queryString = ms[2];
            }
        }

        // fixing ui if there's any query string in it
        if (info.uri && info.uri.match(/\?/)) {
            let ms = info.url.match(/^([^\?]+)\?(.*)$/);
            if (ms) {
                info.uri = ms[1];
            }
        }

        // generating path to phpfile
        if (!info.uri.match(/^\//)) {
            info.uri = '/' + info.uri;
        }
        let phpFile: string = info.uri;
        phpFile = this.configuration.documentRoot + phpFile;

        // generating environment variables to send php-fpm
        // Default server vars
        var fastCGIParams = {
            QUERY_STRING: info.queryString || '',
            REQUEST_METHOD: info.method,
            CONTENT_TYPE: info.contentType || '',
            CONTENT_LENGTH: info.contentLength || '',
            SCRIPT_FILENAME: phpFile,
            SCRIPT_NAME: phpFile.split('/').pop(),
            REQUEST_URI: info.url,
            DOCUMENT_URI: info.uri,
            DOCUMENT_ROOT: this.configuration.documentRoot,
            SERVER_PROTOCOL: 'HTTP/1.1',
            GATEWAY_INTERFACE: 'CGI/1.1',
            REMOTE_ADDR: '127.0.0.1',
            REMOTE_PORT: 1234,
            SERVER_ADDR: '127.0.0.1',
            SERVER_PORT: 80,
            SERVER_NAME: '127.0.0.1',
            SERVER_SOFTWARE: 'node-phpfpm',
            REDIRECT_STATUS: 200,
            ...this.configuration.environmentVariables
        };

        // running the request
        var i = info;
        this.client.request(fastCGIParams, (err: any, request: any) => {
            if (err) {
                cb(99, err.toString(), err.toString());
                return;
            }

            var body = '', errors = '';
            request.stdout.on('data', (data: any) => {
                body += data.toString('utf8');
            });

            request.stderr.on('data', (data: any) => {
                errors += data.toString('utf8');
            });

            request.stdout.on('end', () => {
                body = body.replace(/^[\s\S]*?\r\n\r\n/, '');
                cb(false, body, errors);
            });

            if (i.method == 'POST') {
                request.stdin._write(i.body, 'utf8');
            }
            request.stdin.end();
        });
    }

    private clearQueue() {
        let evt: request | undefined;
        while (evt = this.queue.shift()) {
            this.run(evt.info, evt.cb);
        }
    }
}