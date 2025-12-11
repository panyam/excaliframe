const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  const config = {
    entry: {
      editor: isDev
        ? ['webpack-hot-middleware/client?reload=true', './src/editor/index.tsx']
        : './src/editor/index.tsx',
      renderer: isDev
        ? ['webpack-hot-middleware/client?reload=true', './src/renderer/index.tsx']
        : './src/renderer/index.tsx',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].bundle.js',
      clean: !isDev, // Don't clean in dev mode (middleware serves from memory)
      publicPath: '/',
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        'roughjs/bin/rough': path.resolve(__dirname, 'node_modules/roughjs/bin/rough.js'),
        'roughjs/bin/generator': path.resolve(__dirname, 'node_modules/roughjs/bin/generator.js'),
        'roughjs/bin/math': path.resolve(__dirname, 'node_modules/roughjs/bin/math.js'),
      },
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/editor/index.html',
        filename: 'editor.html',
        chunks: ['editor'],
      }),
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
        filename: 'renderer.html',
        chunks: ['renderer'],
      }),
    ],
    devtool: isDev ? 'eval-source-map' : 'source-map',
  };

  // Add HMR plugin in development
  if (isDev) {
    config.plugins.push(new webpack.HotModuleReplacementPlugin());
  }

  return config;
};
