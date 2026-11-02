/** T7 僅驗證已遷移教材，單頁檢核與按 owner_code 彙總的答案分布分開處理。 */
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function fourOptions(value) { return record(value) && Object.keys(value).length === 4 && Object.keys(value).sort().join('') === 'ABCD' && Object.values(value).every(nonempty); }

export function checkT7(data, fieldLine, add) {
  if (data.textbook !== 'v2') return;
  const checks = Array.isArray(data.self_check) ? data.self_check : [];
  for (const [i, goal] of (Array.isArray(data.goals) ? data.goals : []).entries()) {
    if (nonempty(goal?.id) && !checks.some((check) => check?.goal === goal.id)) add('T7', fieldLine(['goals', i]), `學習目標 ${goal.id} 至少需要一題檢核小題。`);
  }
  const choices = checks.filter((check) => check?.type === 'choice');
  const lastChoice = checks.findLastIndex((check) => check?.type === 'choice');
  checks.forEach((check, i) => {
    if (check?.type === 'short' && i < lastChoice) add('T7', fieldLine(['self_check', i]), 'short 出現在 choice 之前；所有 choice 必須排在 short 前面。');
  });
  if (checks.length && choices.length * 3 < checks.length * 2) add('T7', fieldLine(['self_check']), `選擇題占比 ${choices.length}/${checks.length}，低於 2/3。`, 'warning');
  checks.forEach((check, i) => {
    if (check?.type !== 'choice') return;
    const line = fieldLine(['self_check', i]);
    if (!fourOptions(check.options)) add('T7', line, 'choice 必須正好有 A–D 四個非空白選項。');
    if (!fourOptions(check.explain)) add('T7', line, 'choice explain 必須正好對應 A–D，且每個理由不可空白。');
    if (record(check.options) && Object.values(check.options).some((option) => typeof option === 'string' && /以上皆(?:是|非)/.test(option))) add('T7', line, '選項不得包含「以上皆是／以上皆非」。');
  });
  if (choices.length >= 2 && /^[A-D]$/.test(choices[0].answer) && choices.every((check) => check.answer === choices[0].answer)) add('T7', fieldLine(['self_check']), `同頁 ${choices.length} 題選擇題正解全為 ${choices[0].answer}。`);
}

export function checkUnitAnswers(pages) {
  const units = new Map();
  for (const { data, file, fieldLine, ownerCode } of pages) {
    if (data.textbook !== 'v2' || !ownerCode) continue;
    for (const check of Array.isArray(data.self_check) ? data.self_check : []) {
      if (check?.type !== 'choice' || !/^[A-D]$/.test(check.answer)) continue;
      if (!units.has(ownerCode)) units.set(ownerCode, { counts: { A: 0, B: 0, C: 0, D: 0 }, total: 0, file, line: fieldLine(['self_check']) });
      const unit = units.get(ownerCode); unit.counts[check.answer]++; unit.total++;
    }
  }
  return [...units].flatMap(([owner, unit]) => unit.total < 8 ? [] : Object.entries(unit.counts).flatMap(([letter, count]) => count / unit.total > 0.4 ? [{ rule: 'T7', severity: 'warning', file: unit.file, line: unit.line, message: `單元 ${owner} 的 ${letter} 正解占 ${count}/${unit.total}（${(count / unit.total * 100).toFixed(1)}%），超過 40%。` }] : []));
}
