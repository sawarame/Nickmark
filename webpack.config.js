const path = require('path');
const { VueLoaderPlugin } = require('vue-loader');

module.exports = {
  mode: 'production',
  entry: {
    background: './src/background.ts',
    list: './src/list.ts',
    preferences: './src/preferences.ts'
  },
  output: {
    path: path.resolve(__dirname, 'Nickmark/js'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          appendTsSuffixTo: [/\.vue$/],
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.vue'],
    alias: {
      'vue': '@vue/runtime-dom'
    }
  },
  plugins: [
    new VueLoaderPlugin()
  ],
  devtool: 'source-map'
};