/* eslint global-require: off, import/no-dynamic-require: off */

/**
 * Build config for development electron renderer process that uses
 * Hot-Module-Replacement
 *
 * https://webpack.js.org/concepts/hot-module-replacement/
 */

const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

import path from 'path';
import webpack from 'webpack';
import { spawn } from 'child_process';

const port = process.env.PORT || 1212;
const publicPath = `http://localhost:${port}/dist`;

export default {
  devtool: 'inline-source-map',

  mode: 'development',

  target: 'electron-renderer',

  entry: path.join(__dirname, '..', 'app', 'index'),

  output: {
    publicPath: `http://localhost:${port}/dist/`,
    filename: 'renderer.js',
  },

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true
          }
        }
      },
      {
        test: /\.global\.css$/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader',
            options: {
              sourceMap: true
            }
          }
        ]
      },
      {
        test: /^((?!\.global).)*\.css$/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader',
            options: {
              modules: true,
              sourceMap: true,
              importLoaders: 1,
              localIdentName: '[name]__[local]__[hash:base64:5]'
            }
          }
        ]
      },
      // SASS support - compile all .global.scss files and pipe it to style.css
      {
        test: /\.scss$/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
              modules: false,
            }
          },
          {
            loader: 'sass-loader'
          }
        ]
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|ico|webp)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
    ]
  },

  plugins: [
    new webpack.NoEmitOnErrorsPlugin(),

    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     *
     * By default, use 'development' as NODE_ENV. This can be overriden with
     * 'staging', for example, by changing the ENV variables in the npm scripts
     */
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'development',
      ELECTRON_OVERRIDE_DIST_PATH:
        path.join(__dirname, '..', '..', 'node_modules', 'electron', 'path.txt')
    }),

    new webpack.LoaderOptionsPlugin({
      debug: true
    }),

    new NodePolyfillPlugin({excludeAliases: ['process']}),
  ],

  node: {
    __dirname: false,
    __filename: false
  },

  devServer: {
    port,
    devMiddleware: {
      publicPath,
      stats: 'errors-only',
    },
    headers: {'Access-Control-Allow-Origin': '*'},
    static: {
      directory: path.join(__dirname, '..', 'dist'),
      watch: {
        ignored: /node_modules/
      },
    },
    historyApiFallback: {
      verbose: true,
      disableDotRule: false
    },
    setupMiddlewares(middlewares, devServer) {
      if (process.env.START_HOT) {
        console.log('Starting Main Process...');
        spawn('npm', ['run', 'start-main-dev'], {
          shell: true,
          env: process.env,
          stdio: 'inherit'
        })
          .on('close', code => process.exit(code))
          .on('error', spawnError => console.error(spawnError));
      }
      return middlewares;
    }
  }
};
