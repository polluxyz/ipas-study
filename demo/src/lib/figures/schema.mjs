/** 驗證受控圖資料，拒絕手填統計量與未知欄位，讓作者宣告與實際繪圖保持同一來源。 */
import { validateSamples } from './metrics.mjs';

function keys(object, allowed, location) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error(`${location} 必須是物件`);
  for (const key of Object.keys(object)) if (!allowed.includes(key)) throw new Error(`${location} 不接受欄位 ${key}`);
}
function text(value, location) { if (typeof value !== 'string' || !value.trim()) throw new Error(`${location} 必須有文字`); }
function finite(value, location) { if (!Number.isFinite(value)) throw new Error(`${location} 必須是有限數字`); }

export function validateFigure(data, expectedId) {
  const shared = ['id', 'kind', 'title', 'description', 'source'];
  const fields = { roc: ['samples', 'thresholds'], pr: ['samples', 'thresholds'], 'confusion-matrix': ['samples', 'threshold'], 'learning-curve': ['metric', 'unit', 'points', 'earlyStopping'], residual: ['samples', 'unit'] };
  if (!data || !Object.hasOwn(fields, data.kind)) throw new Error('未知的圖模板');
  keys(data, [...shared, ...fields[data.kind]], '圖');
  for (const field of ['id', 'title', 'description']) text(data[field], field);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.id) || (expectedId && data.id !== expectedId)) throw new Error('圖 ID 必須與檔名一致，且使用小寫英文、數字、連字號');
  keys(data.source, ['type', 'note'], 'source');
  if (!['synthetic', 'external'].includes(data.source.type)) throw new Error('source.type 必須是 synthetic 或 external');
  text(data.source.note, 'source.note');
  if (['roc', 'pr', 'confusion-matrix'].includes(data.kind)) {
    validateSamples(data.samples);
    if (data.kind === 'confusion-matrix') finite(data.threshold, 'threshold');
    if (data.thresholds !== undefined) {
      if (!Array.isArray(data.thresholds)) throw new Error('thresholds 必須是陣列');
      data.thresholds.forEach((value) => finite(value, 'thresholds'));
    }
  } else if (data.kind === 'learning-curve') {
    text(data.metric, 'metric'); text(data.unit, 'unit');
    if (!Array.isArray(data.points) || data.points.length < 2) throw new Error('學習曲線至少需要兩個 epoch');
    let previous = -Infinity;
    for (const point of data.points) {
      keys(point, ['epoch', 'train', 'validation'], 'points');
      for (const key of ['epoch', 'train', 'validation']) finite(point[key], key);
      if (point.epoch < 0 || point.epoch <= previous) throw new Error('epoch 必須非負且嚴格遞增');
      previous = point.epoch;
    }
    if (data.earlyStopping !== undefined && !data.points.some(({ epoch }) => epoch === data.earlyStopping)) throw new Error('earlyStopping 必須是資料中存在的 epoch');
  } else {
    text(data.unit, 'unit');
    if (!Array.isArray(data.samples) || !data.samples.length) throw new Error('殘差圖需要 samples');
    for (const sample of data.samples) {
      keys(sample, ['actual', 'predicted'], 'samples');
      finite(sample.actual, 'actual'); finite(sample.predicted, 'predicted');
      finite(sample.actual - sample.predicted, 'residual');
    }
  }
  return data;
}
