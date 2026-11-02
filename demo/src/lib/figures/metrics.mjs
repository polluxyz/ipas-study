/** 二元分類的所有數值共用原始樣本與 >= 閾值規則；未定義比例回傳 null，避免把零當成答案。 */
export function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

export function validateSamples(samples) {
  if (!Array.isArray(samples) || samples.length === 0) throw new Error('samples 必須是非空陣列');
  for (const sample of samples) {
    if (![0, 1].includes(sample.label) || !Number.isFinite(sample.score)) throw new Error('樣本需要 label: 0 | 1 與有限 score');
    if (Object.keys(sample).some((key) => !['label', 'score'].includes(key))) throw new Error('樣本只接受 label、score');
  }
}

export function confusion(samples, threshold) {
  validateSamples(samples);
  if (!Number.isFinite(threshold) && threshold !== Infinity) throw new Error('threshold 必須是數字');
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const { label, score } of samples) {
    if (score >= threshold) { if (label === 1) tp++; else fp++; }
    else if (label === 1) fn++; else tn++;
  }
  const precision = ratio(tp, tp + fp), recall = ratio(tp, tp + fn);
  return { tp, fp, tn, fn, precision, recall, fpr: ratio(fp, fp + tn), accuracy: (tp + tn) / samples.length, f1: ratio(2 * tp, 2 * tp + fp + fn) };
}

export function classificationCurve(samples) {
  validateSamples(samples);
  const positives = samples.filter(({ label }) => label === 1).length;
  const negatives = samples.length - positives;
  if (!positives || !negatives) throw new Error('ROC／PR 需要正負兩種類別，單一類別不能繪製');
  // 同分樣本一次加入，避免任意排序改變 AUC；O(n log n)，不逐閾值重掃樣本。
  const sorted = [...samples].sort((a, b) => b.score - a.score);
  const points = [{ threshold: Infinity, tp: 0, fp: 0, tpr: 0, fpr: 0, precision: 1, recall: 0 }];
  let tp = 0, fp = 0;
  for (let index = 0; index < sorted.length;) {
    const threshold = sorted[index].score;
    do { if (sorted[index].label === 1) tp++; else fp++; index++; } while (index < sorted.length && sorted[index].score === threshold);
    points.push({ threshold, tp, fp, tpr: tp / positives, fpr: fp / negatives, precision: tp / (tp + fp), recall: tp / positives });
  }
  let auc = 0, averagePrecision = 0;
  for (let i = 1; i < points.length; i++) {
    auc += (points[i].fpr - points[i - 1].fpr) * (points[i].tpr + points[i - 1].tpr) / 2;
    averagePrecision += (points[i].recall - points[i - 1].recall) * points[i].precision;
  }
  return { points, auc, averagePrecision, prevalence: positives / samples.length };
}
