# 健身计划记录小程序

基于 **凯圣王、谭成义三分化训练计划** 的微信小程序，帮助健身者记录训练进度和饮食营养摄入。

## 功能特性

### 训练计划展示
- 完整展示三分化训练计划（胸·三角肌中束·三头 / 背·三角肌后束·二头 / 臀·股四头肌）
- 每个动作包含组数、次数和备注说明
- 支持按周期（第1周 / 第2周 / 第3周）切换查看不同训练安排

### 训练记录
- 选择训练日类型，记录每个动作的完成情况
- 支持录入每组的实际重量（kg）和实际次数
- 单组和整个动作的完成状态切换
- 实时训练进度展示
- 训练记录按日期自动保存

### 历史记录
- 按日期查看所有训练记录
- 训练详情弹窗展示每组数据
- 支持删除历史记录
- 饮食记录按日期汇总展示

### 食物营养扫描
- 拍照识别食物（AI接口已预留）
- 从相册选择食物图片识别
- 手动添加食物营养数据
- 每日营养摄入总览（热量、蛋白质、脂肪、碳水化合物）
- 支持删除饮食记录

### 数据统计
- 训练天数、连续训练天数、总完成率
- 三分化训练分布统计
- 动作完成情况统计
- 最近7天训练打卡日历
- 近7天营养摄入趋势

## 项目结构

```
fitness-miniapp/
├── app.js                    # 全局入口，训练计划数据定义
├── app.json                  # 小程序配置（页面路由、TabBar）
├── app.wxss                  # 全局样式（CSS变量、通用组件样式）
├── project.config.json       # 项目配置
├── sitemap.json              # 站点地图
├── README.md                 # 项目说明文档
│
├── pages/
│   ├── index/                # 首页 - 训练计划展示
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   ├── index.js
│   │   └── index.json
│   │
│   ├── record/               # 训练记录页面
│   │   ├── record.wxml
│   │   ├── record.wxss
│   │   ├── record.js
│   │   └── record.json
│   │
│   ├── history/              # 历史记录页面
│   │   ├── history.wxml
│   │   ├── history.wxss
│   │   ├── history.js
│   │   └── history.json
│   │
│   ├── nutrition/            # 食物营养扫描页面
│   │   ├── nutrition.wxml
│   │   ├── nutrition.wxss
│   │   ├── nutrition.js
│   │   └── nutrition.json
│   │
│   └── stats/                # 数据统计页面
│       ├── stats.wxml
│       ├── stats.wxss
│       ├── stats.js
│       └── stats.json
│
├── components/
│   └── empty-state/          # 空状态组件
│       ├── empty-state.wxml
│       ├── empty-state.wxss
│       ├── empty-state.js
│       └── empty-state.json
│
├── utils/
│   └── util.js               # 工具函数（日期、存储、统计）
│
└── images/                   # TabBar 图标
    ├── plan.png
    ├── plan-active.png
    ├── record.png
    ├── record-active.png
    ├── food.png
    ├── food-active.png
    ├── history.png
    ├── history-active.png
    ├── stats.png
    └── stats-active.png
```

## 技术说明

### 开发框架
- 微信小程序原生开发（WXML + WXSS + JS）
- 不依赖任何第三方框架或组件库

### 数据存储
- 使用微信小程序本地 Storage（`wx.setStorageSync` / `wx.getStorageSync`）
- 训练记录键名格式：`training_YYYY-MM-DD`
- 饮食记录键名格式：`nutrition_YYYY-MM-DD`
- 日期索引键名：`training_dates` / `nutrition_dates`

### AI食物识别接口预留
在 `pages/nutrition/nutrition.js` 的 `analyzeFood` 方法中已预留AI接口调用位置，当前使用模拟数据。接入真实AI接口时，只需替换该方法中的模拟代码即可：

```javascript
// 替换为真实API调用
wx.uploadFile({
  url: 'https://your-api-server.com/api/food-recognize',
  filePath: imagePath,
  name: 'image',
  header: { 'Authorization': 'Bearer YOUR_API_KEY' },
  success: (res) => {
    const data = JSON.parse(res.data);
    this.setData({
      scanResult: {
        name: data.food_name,
        calories: data.calories,
        protein: data.protein,
        fat: data.fat,
        carbs: data.carbs
      },
      scanImagePath: imagePath
    });
  }
});
```

### 设计风格
- 深色导航栏 + 浅色背景
- 主色调：#E94560（活力红）
- 辅助色：#1A1A2E（深蓝黑）、#0F3460（深蓝）、#16C79A（绿色）
- 圆角卡片 + 柔和阴影
- 渐变按钮 + 流畅动画

## 使用方法

1. 下载并解压项目文件
2. 打开微信开发者工具
3. 选择"导入项目"
4. 选择解压后的 `fitness-miniapp` 目录
5. 填入你的小程序 AppID（或使用测试号）
6. 即可预览和调试

## 注意事项

- 首次使用需要在 `project.config.json` 中替换 `appid` 为你自己的小程序 AppID
- 食物营养扫描功能当前使用模拟数据，接入真实AI接口需要配置服务器域名
- 本地 Storage 容量上限为 10MB，长期使用建议定期清理历史数据或接入云存储
