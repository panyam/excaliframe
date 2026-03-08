const path = require('path');
const fs = require('fs');
const CopyWebpackPlugin = require('copy-webpack-plugin');

// Minimal plugin that writes manifest.json mapping entry names to hashed filenames.
class ManifestPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tap('ManifestPlugin', (compilation) => {
      const manifest = {};
      for (const asset of compilation.getAssets()) {
        if (asset.name.endsWith('.js') && !asset.name.endsWith('.map')) {
          // Map logical name (e.g. "bundle") to hashed filename
          const logical = asset.name.replace(/\.[a-f0-9]{8}\.js$/, '.js');
          manifest[logical] = asset.name;
        }
      }
      const outDir = compilation.outputOptions.path;
      fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest));
    });
  }
}

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
    // Prefer ESM ('module') over IIFE browser bundles ('browser') so that
    // packages like @panyam/servicekit-client resolve to proper ES modules
    // instead of their IIFE global-var build.
    mainFields: ['module', 'main'],
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

  // Content-hash filenames for cache busting.
  // Each bundle writes a manifest.json mapping logical names → hashed filenames.
  const hashFilename = isDev ? 'bundle.js' : 'bundle.[contenthash:8].js';
  const hashChunkFilename = isDev ? '[name].js' : '[name].[contenthash:8].js';

  const sharedPlugins = isDev ? [] : [new ManifestPlugin()];

  // --- Listing bundle (vanilla TS + jsx-dom, small) ---
  const listing = {
    name: 'playground-listing',
    entry: './pages/listing/index.tsx',
    output: {
      path: path.resolve(__dirname, 'static/playground/listing'),
      filename: hashFilename,
      clean: true,
      publicPath: '/static/playground/listing/',
    },
    module: { rules: sharedRules },
    resolve: sharedResolve,
    plugins: [...sharedPlugins],
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
      filename: hashFilename,
      clean: true,
      publicPath: '/static/playground/detail/',
    },
    module: { rules: sharedRules },
    resolve: sharedResolve,
    plugins: [...sharedPlugins],
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
      filename: hashFilename,
      chunkFilename: hashChunkFilename,
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
      ...sharedPlugins,
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
