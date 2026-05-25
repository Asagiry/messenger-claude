module.exports = {
  apps: [
    {
      name: 'messenger',
      cwd: __dirname + '/server',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '80',
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/app',
        JWT_SECRET: 'prod-messenger-secret-7421-claude'
      },
      max_memory_restart: '512M',
      out_file: './logs/out.log',
      error_file: './logs/err.log',
      merge_logs: true,
      time: true
    }
  ]
};
