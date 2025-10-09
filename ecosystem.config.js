module.exports = {
  apps: [
    {
      name: 'defipoly-api',
      script: './server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        MONGO_URI: 'mongodb://localhost:27017'
      }
    },
    {
      name: 'defipoly-indexer',
      script: './indexer.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        SOLANA_RPC_URL: 'https://api.devnet.solana.com',
        MONGO_URI: 'mongodb://localhost:27017',
        PROGRAM_ID: 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'
      }
    }
  ]
};