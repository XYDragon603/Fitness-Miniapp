function home() { return { title: '健行计划 · 记录训练与饮食，每一次都算数', path: '/pages/today/today' }; }
function menu(api) { if (typeof api.showShareMenu === 'function') api.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] }); }
function favoriteGuide(api) { api.showModal({ title: '收藏健行计划', content: '在微信中点击右上角“…”菜单，选择“添加到我的小程序”或“收藏”（以当前微信菜单为准），之后可快速找到。', showCancel: false, confirmText: '知道了' }); }
function favorite() { return { title: '健行计划', query: '' }; }
module.exports = { home, menu, favoriteGuide, favorite };
