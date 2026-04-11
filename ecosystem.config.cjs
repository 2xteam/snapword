/**
 * PM2 예시 (Cloudways 등)
 *   npm.cmd run build
 *   pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "snapword-next",
      cwd: __dirname,
      script: "npm",
      args: "run start",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
