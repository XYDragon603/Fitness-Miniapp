module.exports = {
  version: 1, source: 'fixture', attribution: '动作数据来自 exercises-dataset（MIT）',
  bodyParts: [{ key: 'chest', label: '胸部', count: 4 }, { key: 'back', label: '背部', count: 2 }, { key: 'shoulders', label: '肩部', count: 1 }, { key: 'upper legs', label: '大腿/臀', count: 2 }, { key: 'waist', label: '腰腹核心', count: 1 }],
  equipmentGroups: [{ key: 'bodyweight', label: '自重', count: 3 }, { key: 'dumbbell', label: '哑铃', count: 3 }, { key: 'barbell', label: '杠铃', count: 2 }, { key: 'cable', label: '绳索', count: 2 }],
  equipmentLabels: { barbell: '杠铃', dumbbell: '哑铃', cable: '绳索', 'body weight': '自重' },
  muscleLabels: { pectorals: '胸肌', chest: '胸肌', triceps: '肱三头肌', shoulders: '肩部', lats: '背阔肌', biceps: '肱二头肌', back: '背部', delts: '三角肌', quads: '股四头肌', glutes: '臀肌', legs: '腿部', abs: '腹肌', core: '核心' },
  fields: ['id', 'name', 'nameEn', 'bodyPart', 'equipment', 'equipmentGroup', 'target'],
  rows: [
    ['0025', '杠铃平板卧推', 'barbell bench press', 'chest', 'barbell', 'barbell', 'pectorals'],
    ['0026', '哑铃平板卧推', 'dumbbell bench press', 'chest', 'dumbbell', 'dumbbell', 'pectorals'],
    ['0027', '绳索夹胸', 'cable fly', 'chest', 'cable', 'cable', 'pectorals'],
    ['0028', '俯卧撑', 'push up', 'chest', 'body weight', 'bodyweight', 'pectorals'],
    ['0030', '哑铃划船', 'dumbbell row', 'back', 'dumbbell', 'dumbbell', 'lats'],
    ['0031', '绳索下拉', 'cable pulldown', 'back', 'cable', 'cable', 'lats'],
    ['0040', '哑铃肩推', 'dumbbell shoulder press', 'shoulders', 'dumbbell', 'dumbbell', 'delts'],
    ['0050', '杠铃深蹲', 'barbell squat', 'upper legs', 'barbell', 'barbell', 'quads'],
    ['0051', '自重深蹲', 'body weight squat', 'upper legs', 'body weight', 'bodyweight', 'quads'],
    ['0060', '平板支撑', 'plank', 'waist', 'body weight', 'bodyweight', 'abs']
  ]
};
