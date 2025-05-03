module.exports = {
  apps: [
    {
      name: 'visa-bot',
      script: 'index.js',
      watch: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log'
    }
  ]
};

