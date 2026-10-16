// Read-only application-level check using the official WeChat automation SDK.
// Run the IDE with: cli auto --project <repo> --auto-port 9420
const automator = require('../tmp-downloads/backup-qa/node_modules/miniprogram-automator');
async function main() {
  const miniProgram = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  try {
    const result = await miniProgram.evaluate(async () => {
      const app = getApp();
      const env = app && app.globalData && app.globalData.cloudEnvId;
      if (env !== 'cloud1-d2gqjtnis5f2da698') return { ok: false, error: 'unexpected_project_environment', env };
      try {
        const response = await wx.cloud.callFunction({ name: 'userBackup', data: { action: 'status' }, config: { env } });
        const data = response.result || {};
        return { env, ok: data.ok === true, protocol: data.protocol || null, exists: data.exists === true,
          error: data.error || '', stage: data.stage || '', code: data.code || '', detail: data.detail || '', requestId: response.requestID || '' };
      } catch (error) { return { env, ok: false, error: String(error.errMsg || error.message || 'cloud_call_failed').slice(0, 500) }; }
    });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } finally { await miniProgram.disconnect(); }
}
main().catch(error => { console.error(String(error.message || error)); process.exitCode = 1; });
