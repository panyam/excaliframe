const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    editor: './src/editor/index.tsx',
    renderer: './src/renderer/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    clean: true,
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
  devtool: 'source-map',
  watchOptions: {
    poll: 1000, // Check for changes every second (needed for Docker volumes)
    aggregateTimeout: 300, // Delay before rebuilding
    ignored: /node_modules/,
  },
};
