const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  // Shared module rules and resolve config
  const sharedRules = [
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
  ];

  const sharedResolve = {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  };

  const sharedOptimization = {
    splitChunks: false,
    runtimeChunk: false,
  };

  // --- Listing bundle (vanilla TS + jsx-dom, small) ---
  const listing = {
    name: 'playground-listing',
    entry: './playground/listing/index.tsx',
    output: {
      path: path.resolve(__dirname, 'site/static/playground/listing'),
      filename: 'bundle.js',
      clean: true,
      publicPath: '/static/playground/listing/',
    },
    module: { rules: sharedRules },
    resolve: sharedResolve,
    devtool: isDev ? 'eval-source-map' : 'source-map',
    optimization: sharedOptimization,
    performance: { hints: false },
  };

  // --- Detail bundle (jsx-dom, small) ---
  const detail = {
    name: 'playground-detail',
    entry: './playground/detail/index.tsx',
    output: {
      path: path.resolve(__dirname, 'site/static/playground/detail'),
      filename: 'bundle.js',
      clean: true,
      publicPath: '/static/playground/detail/',
    },
    module: { rules: sharedRules },
    resolve: sharedResolve,
    devtool: isDev ? 'eval-source-map' : 'source-map',
    optimization: sharedOptimization,
    performance: { hints: false },
  };

  // --- Excalidraw bundle (React + Excalidraw, large ~400KB) ---
  const excalidraw = {
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
    module: { rules: sharedRules },
    resolve: {
      ...sharedResolve,
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
    optimization: sharedOptimization,
    performance: { hints: false },
  };

  return [listing, detail, excalidraw];
};
