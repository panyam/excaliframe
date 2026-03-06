const path = require('path');
const rspack = require('@rspack/core');

// Build config for a single entry point
const createConfig = (name, isDev) => {
  const plugins = [
    new rspack.HtmlRspackPlugin({
      template: `./src/${name}/index.html`,
      filename: 'index.html',
    }),
  ];

  // Copy Excalidraw fonts only for editor
  if (name === 'editor') {
    plugins.push(
      new rspack.CopyRspackPlugin({
        patterns: [
          {
            from: path.join(path.dirname(require.resolve('@excalidraw/excalidraw')), 'fonts'),
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
      chunkFilename: '[name].js',
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
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
              },
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
    plugins,
    devtool: isDev ? 'eval-source-map' : 'source-map',
    optimization: {
      splitChunks: name === 'editor' ? { chunks: 'async' } : false,
      runtimeChunk: false,
    },
    performance: {
      hints: false,
    },
  };
};

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  // Return array of configs - rspack builds each independently
  return [
    createConfig('editor', isDev),
    createConfig('renderer', isDev),
  ];
};
