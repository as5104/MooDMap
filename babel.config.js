module.exports = function (api) {
  api.cache(true);
  const plugins = [];

  // Strip all console.* calls in production builds (APK/release)
  if (process.env.NODE_ENV === 'production') {
    plugins.push('transform-remove-console');
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
