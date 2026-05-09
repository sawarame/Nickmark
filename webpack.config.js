const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    background: './src/background.ts',
    options: './src/options.ts'
  },
  output: {
    path: path.resolve(__dirname, 'Nickmark/js'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  devtool: 'source-map'
};