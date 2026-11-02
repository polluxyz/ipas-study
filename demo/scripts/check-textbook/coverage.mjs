/** 涵蓋表以範圍內的學習目標計算兩種比例，避免把已建連結誤報成已完成內容審查。 */
export function coverageHeaders() {
  return {
    topics: ['topic_id', 'parent_topic_id', 'guide_id', 'guide_edition', 'code', 'guide_section', 'printed_pages', 'pdf_pages', 'topic_title', 'origin', 'learning_goal', 'required_evidence', 'in_scope', 'scope_reason', 'source_issue'],
    coverage: ['topic_id', 'goal_id', 'concept_id', 'section_anchor', 'evidence_refs', 'coverage_state', 'reviewer', 'reviewed_revision', 'review_note'],
  };
}

export function parseCsv(source) {
  const input = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const rows = [];
  let fields = [];
  let value = '';
  let quoted = false;
  let closed = false;
  let line = 1;
  let start = 1;
  const errors = [];
  function finishField() { fields.push(value.trim()); value = ''; closed = false; }
  function finishRow() {
    finishField();
    if (fields.some((cell) => cell !== '')) rows.push({ cells: fields, line: start });
    fields = []; start = line + 1;
  }
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else { value += char; if (char === '\n') line++; }
    } else if (char === ',' ) finishField();
    else if (char === '\n') { finishRow(); line++; }
    else if (char === '"' && !value && !closed) quoted = true;
    else if ((closed && !/\s/.test(char)) || char === '"') { errors.push({ line, message: 'CSV 引號格式錯誤。' }); value += char; }
    else value += char;
  }
  if (quoted) errors.push({ line: start, message: 'CSV 引號未閉合。' });
  if (value || fields.length || closed) finishRow();
  return { rows, errors };
}

export function checkCoverage(topicsSource, coverageSource, topicsFile, coverageFile, conceptRevisions = new Map()) {
  const issues = [];
  const add = (file, line, message, severity = 'error') => issues.push({ rule: 'T6', severity, file, line, message });
  const headers = coverageHeaders();
  function readTable(source, file, expected) {
    if (source === undefined) return undefined;
    const parsed = parseCsv(source);
    for (const error of parsed.errors) add(file, error.line, error.message);
    const header = parsed.rows[0];
    if (!header) { add(file, 1, 'CSV 缺少欄位列。'); return []; }
    const missing = expected.filter((name) => !header.cells.includes(name));
    const extra = header.cells.filter((name) => !expected.includes(name));
    if (missing.length || extra.length || new Set(header.cells).size !== header.cells.length) {
      add(file, header.line, `CSV 欄位不符規格；缺少：${missing.join('、') || '無'}；多餘：${extra.join('、') || '無'}；重複：${new Set(header.cells).size !== header.cells.length ? '有' : '無'}。`);
    }
    return parsed.rows.slice(1).map((row) => {
      const valid = row.cells.length === header.cells.length && !missing.length && !extra.length && !parsed.errors.length && new Set(header.cells).size === header.cells.length;
      if (row.cells.length !== header.cells.length) add(file, row.line, `CSV 資料有 ${row.cells.length} 欄，欄位列有 ${header.cells.length} 欄。`);
      return { ...Object.fromEntries(header.cells.map((key, i) => [key, row.cells[i] ?? ''])), line: row.line, valid };
    });
  }
  const topics = readTable(topicsSource, topicsFile, headers.topics);
  const coverage = readTable(coverageSource, coverageFile, headers.coverage);
  const topicIds = new Set();
  const scoped = [];
  const truth = new Set(['true', 'yes', '1', '是']);
  const falsity = new Set(['false', 'no', '0', '否']);
  for (const row of topics ?? []) {
    for (const key of ['topic_id', 'guide_id', 'guide_edition', 'code', 'guide_section', 'topic_title', 'origin', 'learning_goal', 'required_evidence', 'in_scope']) {
      if (!row[key]) { add(topicsFile, row.line, `主題欄位 ${key} 不可空白。`); row.valid = false; }
    }
    if (row.topic_id && topicIds.has(row.topic_id)) { add(topicsFile, row.line, `topic_id 重複：${row.topic_id}。`); row.valid = false; }
    topicIds.add(row.topic_id);
    const scope = row.in_scope?.toLowerCase();
    if (!truth.has(scope) && !falsity.has(scope)) { add(topicsFile, row.line, 'in_scope 必須為 true／false（亦接受 yes／no、1／0、是／否）。'); row.valid = false; }
    if (row.valid && truth.has(scope)) scoped.push(row);
  }
  for (const row of coverage ?? []) {
    if (!row.topic_id || (topics && !topicIds.has(row.topic_id))) { add(coverageFile, row.line, `涵蓋列 topic_id 不存在：${row.topic_id || '（空白）'}。`); row.valid = false; }
    if (!['unmapped', 'mentioned', 'partial', 'complete'].includes(row.coverage_state)) { add(coverageFile, row.line, 'coverage_state 必須是 unmapped、mentioned、partial 或 complete。'); row.valid = false; }
    if (row.coverage_state !== 'unmapped') {
      for (const key of ['concept_id', 'section_anchor']) if (!row[key]) { add(coverageFile, row.line, `已對應列缺少 ${key}。`); row.valid = false; }
      for (const key of ['goal_id', 'evidence_refs']) if (!row[key]) add(coverageFile, row.line, `已對應列尚未補齊 ${key}。`, 'warning');
    }
    if (row.coverage_state === 'complete' && (!row.reviewer || !row.reviewed_revision)) add(coverageFile, row.line, 'complete 列必須有 reviewer 與 reviewed_revision，才能算審查完整。');
    const currentRevision = conceptRevisions.get(row.concept_id);
    row.reviewValid = Boolean(row.reviewer && currentRevision && row.reviewed_revision === currentRevision);
    if (row.reviewer && !row.reviewValid) {
      const reason = !currentRevision ? '概念頁不存在' : !row.reviewed_revision ? '缺少 reviewed_revision' : '雜湊不符';
      add(coverageFile, row.line, `概念頁 ${row.concept_id || '（空白）'} 審查無效（${reason}），請重新審查並更新 reviewed_revision。`, 'warning');
    }
  }
  if (topics === undefined && coverage !== undefined) add(topicsFile, 1, '缺少 guide-topics.csv，無法計算涵蓋率。', 'warning');
  let mapped = 0;
  let reviewed = 0;
  for (const topic of scoped) {
    const rows = (coverage ?? []).filter((row) => row.topic_id === topic.topic_id);
    const mappedRows = rows.filter((row) => row.valid && row.coverage_state !== 'unmapped' && row.concept_id && row.section_anchor);
    if (topic.valid && mappedRows.length) mapped++;
    // 支援頁可以只教部分內容，但每一列都須對應有效版本，避免舊審查掩蓋尚未確認的教材。
    if (topic.valid && rows.some((row) => row.valid && row.coverage_state === 'complete' && row.reviewValid)
      && rows.every((row) => mappedRows.includes(row) && !['unmapped', 'mentioned'].includes(row.coverage_state) && row.reviewValid)) reviewed++;
  }
  const available = topics !== undefined && coverage !== undefined;
  const total = scoped.length;
  return {
    issues,
    metrics: {
      available, denominator: 'in_scope 學習目標（topic_id）', total, mapped, reviewed,
      mappedRate: available && total ? mapped / total * 100 : null,
      reviewedRate: available && total ? reviewed / total * 100 : null,
      mappingReviews: {
        valid: (coverage ?? []).filter((row) => row.reviewValid).length,
        total: (coverage ?? []).length,
        states: Object.fromEntries(['unmapped', 'mentioned', 'partial', 'complete'].map((state) => [state, (coverage ?? []).filter((row) => row.coverage_state === state).length])),
      },
    },
  };
}
