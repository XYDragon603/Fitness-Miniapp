/**
 * 空状态组件
 * @property {string} icon - 图标 emoji
 * @property {string} title - 标题文本
 * @property {string} desc - 描述文本（可选）
 */
Component({
  properties: {
    icon: {
      type: String,
      value: '📭'
    },
    title: {
      type: String,
      value: '暂无数据'
    },
    desc: {
      type: String,
      value: ''
    }
  }
});
