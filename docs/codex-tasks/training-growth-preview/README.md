# 训练成长功能预览

这两张图片由 `utils/share-card.js` 的真实 Canvas 导出器生成，使用示例数字，不代表用户的训练数据。尺寸均为 750×1120。

- [完成训练卡片](session.png)
- [每周周报卡片](week.png)

重新生成：`node tools/render-growth-preview.js`。脚本使用本机 Chromium 和已安装的 Playwright，不修改应用数据。

实际小程序页面：我的 → 训练周报；历史当天详情 → 生成训练分享卡片。通过保存图片手动分享到朋友圈，或转发摘要小程序卡片。
