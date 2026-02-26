const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return {
    name: 'playground-excalidraw',
    entry: './playground/excalidraw/index.tsx',
    output: {
      path: path.resolve(__dirname, 'site/static/playground/excalidraw'),
      filename: 'bundle.js',
      chunkFilename: '[id].js',
      assetModuleFilename: '[hash][ext]',
      clean: true,
      publicPath: '/static/playground/excalidraw/',
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
        'roughjs/bin/rough': require.resolve('roughjs/bin/rough'),
        'roughjs/bin/generator': require.resolve('roughjs/bin/generator'),
        'roughjs/bin/math': require.resolve('roughjs/bin/math'),
      },
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(path.dirname(require.resolve('@excalidraw/excalidraw')), 'fonts'),
            to: 'fonts',
          },
        ],
      }),
    ],
    devtool: isDev ? 'eval-source-map' : 'source-map',
    optimization: {
      splitChunks: false,
      runtimeChunk: false,
    },
    performance: {
      hints: false,
    },
  };
};
