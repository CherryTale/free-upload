//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');

/**@type {import('webpack').Configuration}*/
const config = {
    target: 'node', // vscode extensions run in webworker context for VS Code web 📖 -> https://webpack.js.org/configuration/target/#target

    entry: './extension.js', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
    output: {
        // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    devtool: 'source-map',
    externals: {
        vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
        express: 'commonjs express',
        'socket.io': 'commonjs socket.io',
        'crypto-js': 'commonjs crypto-js',
        multer: 'commonjs multer',
        '@ngrok/ngrok': 'commonjs @ngrok/ngrok',  // 忽略 @ngrok/ngrok
        'qrcode-terminal': 'commonjs qrcode-terminal',
        next: 'commonjs next',
        react: 'commonjs react',
        'react-dom': 'commonjs react-dom'
    },
    resolve: {
        // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
        mainFields: ['module', 'main'],
        extensions: ['.ts', '.js'],
        alias: {
            '@server': path.resolve(__dirname, 'packages/server/src')
        },
        fallback: {
            // Webpack 5 no longer polyfills Node.js core modules automatically.
            // see https://webpack.js.org/configuration/resolve/#resolvefallback
            // for the list of Node.js core module polyfills.
            "fs": false,
            "crypto": false,
            "stream": false,
            "buffer": false,
            "util": false,
            "os": false,
            "http": false,
            "https": false,
            "zlib": false,
            "net": false,
            "tls": false,
            "dns": false,
            "dgram": false,
            "child_process": false,
            "cluster": false,
            "worker_threads": false,
            "readline": false,
            "repl": false,
            "vm": false,
            "perf_hooks": false,
            "inspector": false,
            "async_hooks": false,
            "string_decoder": false,
            "url": false,
            "http2": false,
            "http2-wrapper": false,
            "punycode": false,
            "querystring": false,
            "timers": false,
            "tty": false,
            "v8": false
        }
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ]
            },
            {
                test: /\.node$/,
                use: [
                    {
                        loader: 'node-loader'
                    }
                ]
            }
        ]
    },
    node: {
        __dirname: false,
        __filename: false
    }
};
module.exports = config;