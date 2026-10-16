const cloud = require('wx-server-sdk');
const { createService } = require('./service');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const service = createService(cloud.database());
exports.main = event => service(cloud.getWXContext().OPENID, event || {});
