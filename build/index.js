"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var PHPFPM = /** @class */ (function () {
    function PHPFPM(configuration) {
        var _this = this;
        if (configuration === void 0) { configuration = {}; }
        var _a;
        this.configuration = {
            host: '127.0.0.1',
            port: 9000,
            documentRoot: '',
            skipCheckServer: true,
            environmentVariables: {}
        };
        this.ready = false;
        this.queue = [];
        this.configuration = __assign(__assign({}, this.configuration), configuration);
        // fixing the document root
        if (((_a = this.configuration.documentRoot) === null || _a === void 0 ? void 0 : _a.substring(this.configuration.documentRoot.length - 1)) == "/") {
            this.configuration.documentRoot = this.configuration.documentRoot.substring(0, this.configuration.documentRoot.length - 1);
        }
        this.client = require('fastcgi-client')(this.configuration);
        this.client.on('ready', function () {
            _this.ready = true;
            _this.clearQueue();
        });
    }
    PHPFPM.prototype.run = function (info, cb) {
        // check if request info is just a string then build info object
        if (typeof info === 'string') {
            info = {
                url: info,
                uri: info,
            };
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
            }
            else {
                info.body = '';
                var qs = require('urlencode-for-php')(info.form);
                ;
                info.url += (info.url.indexOf('?') === -1) ? '?' + qs : '&' + qs;
            }
        }
        else {
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
            var ms = info.url.match(/^([^\?]+)\?(.*)$/);
            if (ms != null) {
                info.queryString = ms[2];
            }
        }
        // fixing ui if there's any query string in it
        if (info.uri && info.uri.match(/\?/)) {
            var ms = info.url.match(/^([^\?]+)\?(.*)$/);
            if (ms) {
                info.uri = ms[1];
            }
        }
        // generating path to phpfile
        if (!info.uri.match(/^\//)) {
            info.uri = '/' + info.uri;
        }
        var phpFile = info.uri;
        phpFile = this.configuration.documentRoot + phpFile;
        // generating environment variables to send php-fpm
        // Default server vars
        var fastCGIParams = __assign({ QUERY_STRING: info.queryString || '', REQUEST_METHOD: info.method, CONTENT_TYPE: info.contentType || '', CONTENT_LENGTH: info.contentLength || '', SCRIPT_FILENAME: phpFile, SCRIPT_NAME: phpFile.split('/').pop(), REQUEST_URI: info.url, DOCUMENT_URI: info.uri, DOCUMENT_ROOT: this.configuration.documentRoot, SERVER_PROTOCOL: 'HTTP/1.1', GATEWAY_INTERFACE: 'CGI/1.1', REMOTE_ADDR: '127.0.0.1', REMOTE_PORT: 1234, SERVER_ADDR: '127.0.0.1', SERVER_PORT: 80, SERVER_NAME: '127.0.0.1', SERVER_SOFTWARE: 'node-phpfpm', REDIRECT_STATUS: 200 }, this.configuration.environmentVariables);
        // running the request
        var i = info;
        this.client.request(fastCGIParams, function (err, request) {
            if (err) {
                cb(99, err.toString(), err.toString());
                return;
            }
            var body = '', errors = '';
            request.stdout.on('data', function (data) {
                body += data.toString('utf8');
            });
            request.stderr.on('data', function (data) {
                errors += data.toString('utf8');
            });
            request.stdout.on('end', function () {
                body = body.replace(/^[\s\S]*?\r\n\r\n/, '');
                cb(false, body, errors);
            });
            if (i.method == 'POST') {
                request.stdin._write(i.body, 'utf8');
            }
            request.stdin.end();
        });
    };
    PHPFPM.prototype.clearQueue = function () {
        var evt;
        while (evt = this.queue.shift()) {
            this.run(evt.info, evt.cb);
        }
    };
    ;
    return PHPFPM;
}());
exports.PHPFPM = PHPFPM;
