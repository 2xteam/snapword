/**
 * PM2 (Cloudways 등)
 *   npm run build
 *   pm2 start ecosystem.config.cjs
 * GitHub Actions 배포 후: pm2 reload ecosystem.config.cjs --update-env
 */
module.exports = {
  apps: [
    {
      name: "snapword",
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
