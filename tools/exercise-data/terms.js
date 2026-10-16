// 数据集英文术语 → 中文。新增数据集版本时，build.js 会对缺失的术语报错。

const BODY_PARTS = {
  chest: '胸部',
  back: '背部',
  shoulders: '肩部',
  'upper arms': '上臂',
  'lower arms': '前臂',
  'upper legs': '大腿/臀',
  'lower legs': '小腿',
  waist: '腰腹核心',
  cardio: '有氧',
  neck: '颈部'
};

// 筛选条按这个顺序展示
const BODY_PART_ORDER = ['chest', 'back', 'shoulders', 'upper arms', 'upper legs', 'waist', 'lower legs', 'lower arms', 'cardio', 'neck'];

const EQUIPMENT = {
  'body weight': '自重',
  assisted: '辅助器械',
  band: '弹力带',
  'resistance band': '阻力带',
  barbell: '杠铃',
  'olympic barbell': '奥杆',
  'ez barbell': '曲杆',
  'trap bar': '六角杠',
  dumbbell: '哑铃',
  kettlebell: '壶铃',
  cable: '绳索',
  'leverage machine': '固定器械',
  'smith machine': '史密斯机',
  'sled machine': '雪橇机',
  weighted: '负重',
  'medicine ball': '药球',
  'stability ball': '瑞士球',
  'bosu ball': '波速球',
  roller: '泡沫轴',
  'wheel roller': '健腹轮',
  rope: '战绳/绳',
  hammer: '大锤',
  tire: '轮胎',
  'elliptical machine': '椭圆机',
  'skierg machine': '滑雪机',
  'stationary bike': '动感单车',
  'stepmill machine': '登山机',
  'upper body ergometer': '上肢功率车'
};

// 筛选用的器械分组，避免 28 个筛选项
const EQUIPMENT_GROUPS = [
  { key: 'bodyweight', label: '自重', items: ['body weight', 'weighted'] },
  { key: 'dumbbell', label: '哑铃', items: ['dumbbell'] },
  { key: 'barbell', label: '杠铃', items: ['barbell', 'olympic barbell', 'ez barbell', 'trap bar'] },
  { key: 'cable', label: '绳索', items: ['cable'] },
  { key: 'machine', label: '器械', items: ['leverage machine', 'smith machine', 'assisted', 'sled machine'] },
  { key: 'kettlebell', label: '壶铃', items: ['kettlebell'] },
  { key: 'band', label: '弹力带', items: ['band', 'resistance band'] },
  { key: 'other', label: '其他', items: ['medicine ball', 'stability ball', 'bosu ball', 'roller', 'wheel roller', 'rope', 'hammer', 'tire', 'elliptical machine', 'skierg machine', 'stationary bike', 'stepmill machine', 'upper body ergometer'] }
];

const MUSCLES = {
  // target
  abductors: '髋外展肌',
  abs: '腹肌',
  adductors: '内收肌',
  biceps: '肱二头肌',
  calves: '小腿肌',
  'cardiovascular system': '心肺',
  delts: '三角肌',
  forearms: '前臂',
  glutes: '臀肌',
  hamstrings: '腘绳肌',
  lats: '背阔肌',
  'levator scapulae': '肩胛提肌',
  pectorals: '胸肌',
  quads: '股四头肌',
  'serratus anterior': '前锯肌',
  spine: '竖脊肌',
  traps: '斜方肌',
  triceps: '肱三头肌',
  'upper back': '上背',
  // muscle_group / secondary_muscles
  abdominals: '腹肌',
  'ankle stabilizers': '踝关节稳定肌',
  ankles: '踝关节',
  back: '背部',
  brachialis: '肱肌',
  chest: '胸肌',
  core: '核心',
  deltoids: '三角肌',
  feet: '足部',
  'grip muscles': '握力',
  groin: '腹股沟',
  hands: '手部',
  'hip flexors': '髋屈肌',
  'inner thighs': '大腿内侧',
  'latissimus dorsi': '背阔肌',
  'lower abs': '下腹',
  'lower back': '下背',
  obliques: '腹斜肌',
  quadriceps: '股四头肌',
  'rear deltoids': '三角肌后束',
  rhomboids: '菱形肌',
  'rotator cuff': '肩袖',
  shins: '胫骨前肌',
  shoulders: '肩部',
  soleus: '比目鱼肌',
  sternocleidomastoid: '胸锁乳突肌',
  trapezius: '斜方肌',
  'upper chest': '上胸',
  'wrist extensors': '腕伸肌',
  'wrist flexors': '腕屈肌',
  wrists: '手腕'
};

module.exports = {
  BODY_PARTS,
  BODY_PART_ORDER,
  EQUIPMENT,
  EQUIPMENT_GROUPS,
  MUSCLES
};
