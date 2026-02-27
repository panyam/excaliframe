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
    // Resolve all packages from site/node_modules first, so ../src/ files
    // don't pull a second copy from the root node_modules.
    modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
    alias: {
      '@excaliframe': path.resolve(__dirname, '../src'),
    },
  };

  const sharedOptimization = {
    splitChunks: false,
    runtimeChunk: false,
  };

  // --- Listing bundle (vanilla TS + jsx-dom, small) ---
  const listing = {
    name: 'playground-listing',
    entry: './pages/listing/index.tsx',
    output: {
      path: path.resolve(__dirname, 'static/playground/listing'),
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
    entry: './pages/detail/index.tsx',
    output: {
      path: path.resolve(__dirname, 'static/playground/detail'),
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

  // --- Editor dispatcher bundle (React, dynamically loads Excalidraw or Mermaid) ---
  const editor = {
    name: 'playground-editor',
    entry: './pages/editor/index.tsx',
    output: {
      path: path.resolve(__dirname, 'static/playground/editor'),
      filename: 'bundle.js',
      chunkFilename: '[name].js',
      assetModuleFilename: '[hash][ext]',
      clean: true,
      publicPath: '/static/playground/editor/',
    },
    module: { rules: sharedRules },
    resolve: {
      ...sharedResolve,
      alias: {
        ...sharedResolve.alias,
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
      ...sharedOptimization,
      splitChunks: { chunks: 'async' },
    },
    performance: { hints: false },
  };

  return [listing, detail, editor];
};
