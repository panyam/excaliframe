const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

// Build config for a single entry point
const createConfig = (name, isDev) => {
  const plugins = [
    new HtmlWebpackPlugin({
      template: `./src/${name}/index.html`,
      filename: 'index.html',
    }),
  ];

  // Copy Excalidraw fonts only for editor
  if (name === 'editor') {
    plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'node_modules/@excalidraw/excalidraw/dist/prod/fonts',
            to: 'fonts',
          },
        ],
      })
    );
  }

  return {
    name,
    entry: `./src/${name}/index.tsx`,
    output: {
      path: path.resolve(__dirname, `static/${name}`),
      filename: 'bundle.js',
      chunkFilename: '[id].js',
      assetModuleFilename: '[hash][ext]',
      clean: true,
      publicPath: './',
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
    plugins,
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

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  // Return array of configs - webpack builds each independently
  return [
    createConfig('editor', isDev),
    createConfig('renderer', isDev),
  ];
};
