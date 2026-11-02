/** 以概念總表的主責代碼與實際檔案清單建立目錄，純函式不讀檔，讓首頁與目錄共用統計。 */
export interface CatalogConcept { id: string; title: string; href: string; }
export interface CatalogGroup {
  code: string;
  title: string;
  plannedCount: number;
  writtenCount: number;
  concepts: CatalogConcept[];
  guideConcepts: CatalogConcept[];
  supplementConcepts: CatalogConcept[];
  unmappedConcepts: CatalogConcept[];
  href: string | null;
}
export interface CatalogSubject { number: string; title: string; name: string; groups: CatalogGroup[]; }
export interface ConceptCatalog {
  subjects: CatalogSubject[];
  plannedCount: number;
  writtenCount: number;
  availableCodeCount: number;
}

/** 引號內的逗號、換行與雙引號都屬於欄位內容，不能直接用 split 切 CSV。 */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  const source = csv.replace(/^\uFEFF/, '');
  function finishRow() {
    row.push(field);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = []; field = '';
  }
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && char === ',') { row.push(field); field = ''; }
    else if (!quoted && (char === '\r' || char === '\n')) {
      if (char === '\r' && source[index + 1] === '\n') index++;
      finishRow();
    } else field += char;
  }
  if (quoted) throw new Error('概念總表有未閉合的 CSV 引號');
  finishRow();
  return rows;
}

export function parseConceptIndex(csv: string): { id: string; title: string; ownerCode: string }[] {
  const [header = [], ...rows] = parseCsv(csv);
  const fields = ['id', 'title', 'owner_code'].map((name) => {
    const index = header.indexOf(name);
    if (index === -1) throw new Error(`概念總表缺少欄位：${name}`);
    return index;
  });
  return rows.map((row) => ({ id: row[fields[0]].trim(), title: row[fields[1]].trim(), ownerCode: row[fields[2]].trim() }));
}

/** 只抽取排序需要的欄位，讓 CSV 調整欄位位置或含引號逗號時仍能正確對應。 */
function readColumns(csv: string, names: string[]): string[][] {
  const [header = [], ...rows] = parseCsv(csv);
  const columns = names.map((name) => {
    const index = header.indexOf(name);
    if (index === -1) throw new Error(`學習指引資料缺少欄位：${name}`);
    return index;
  });
  return rows.map((row) => columns.map((index) => (row[index] ?? '').trim()));
}

interface TopicOrder { guide: number; supplement: number; }

/** 同一概念可能支援跨代碼或多個目標，需以主題的代碼分開累計，避免跨科提及改變閱讀順序。 */
function buildTopicOrder(coverageCsv: string, topicsCsv: string): Map<string, Map<string, TopicOrder>> {
  const topics = new Map(readColumns(topicsCsv, ['topic_id', 'code', 'origin']).map(([id, code, origin]) => {
    const match = id.match(/-T(\d+)(?:-|$)/);
    if (!match) throw new Error(`學習指引主題編號格式不正確：${id}`);
    if (origin !== 'guide' && origin !== 'supplement') throw new Error(`學習指引主題來源不正確：${origin}`);
    return [id, { code, origin, order: Number(match[1]) }] as const;
  }));
  const byCode = new Map<string, Map<string, TopicOrder>>();
  for (const [topicId, conceptId] of readColumns(coverageCsv, ['topic_id', 'concept_id'])) {
    const topic = topics.get(topicId);
    if (!topic) continue;
    const concepts = byCode.get(topic.code) ?? new Map<string, TopicOrder>();
    const order = concepts.get(conceptId) ?? { guide: Infinity, supplement: Infinity };
    if (topic.origin === 'guide') order.guide = Math.min(order.guide, topic.order);
    else order.supplement = Math.min(order.supplement, topic.order);
    concepts.set(conceptId, order);
    byCode.set(topic.code, concepts);
  }
  return byCode;
}

export function buildConceptCatalog(csv: string, existingIds: Iterable<string>, coverageCsv: string, topicsCsv: string): ConceptCatalog {
  const definitions = [
    { number: '01', title: '人工智慧技術應用與規劃', name: '科目 1・必考', groups: [
      ['L21101', '自然語言處理技術與應用'], ['L21102', '電腦視覺技術與應用'], ['L21103', '生成式 AI 技術與應用'], ['L21104', '多模態人工智慧應用'],
      ['L21201', 'AI 導入評估'], ['L21202', 'AI 導入規劃'], ['L21203', 'AI 風險管理'], ['L21301', '數據準備與模型選擇'], ['L21302', 'AI 技術系統集成與部署'],
    ] },
    { number: '03', title: '機器學習技術與應用', name: '科目 3・機器學習', groups: [
      ['L23101', '機率與統計基礎應用'], ['L23102', '線性代數基礎應用'], ['L23103', '數值優化技術與方法'], ['L23201', '機器學習原理與技術'],
      ['L23202', '常見機器學習演算法'], ['L23203', '深度學習原理與框架'], ['L23301', '數據準備與特徵工程'], ['L23302', '模型選擇與架構設計'],
      ['L23303', '模型訓練、評估與驗證'], ['L23304', '模型調整與優化'], ['L23401', '數據隱私、安全與合規'], ['L23402', '演算法偏見與公平性'],
    ] },
  ];
  const subjects: CatalogSubject[] = definitions.map((subject) => ({ ...subject, groups: subject.groups.map(([code, title]) => ({
    code, title, plannedCount: 0, writtenCount: 0, concepts: [], guideConcepts: [], supplementConcepts: [], unmappedConcepts: [], href: null,
  })) }));
  const groups = subjects.flatMap((subject) => subject.groups);
  const byCode = new Map(groups.map((group) => [group.code, group]));
  const existing = new Set(existingIds);
  const topicOrder = buildTopicOrder(coverageCsv, topicsCsv);
  for (const concept of parseConceptIndex(csv)) {
    const group = byCode.get(concept.ownerCode);
    if (!group) throw new Error(`概念總表的主責代碼不在評鑑範圍：${concept.ownerCode}`);
    group.plannedCount++;
    if (existing.has(concept.id)) group.concepts.push({ id: concept.id, title: concept.title, href: `/concepts/${concept.id}/` });
  }
  for (const group of groups) {
    const orders = topicOrder.get(group.code);
    const ranked = group.concepts.map((concept, index) => {
      const order = orders?.get(concept.id);
      const category = Number.isFinite(order?.guide) ? 0 : Number.isFinite(order?.supplement) ? 1 : 2;
      return { concept, index, category, order: (category === 0 ? order?.guide : order?.supplement) ?? Infinity };
    });
    // 總表位置是最後的比較鍵，讓同主題與無對應的概念維持原先順序。
    ranked.sort((a, b) => a.category - b.category || a.order - b.order || a.index - b.index);
    group.concepts = ranked.map(({ concept }) => concept);
    group.guideConcepts = ranked.filter(({ category }) => category === 0).map(({ concept }) => concept);
    group.supplementConcepts = ranked.filter(({ category }) => category === 1).map(({ concept }) => concept);
    group.unmappedConcepts = ranked.filter(({ category }) => category === 2).map(({ concept }) => concept);
    group.writtenCount = group.concepts.length;
    if (group.writtenCount) group.href = group.code === 'L23303' ? '/codes/L23303/' : `/catalog/#${group.code}`;
  }
  return {
    subjects,
    plannedCount: groups.reduce((total, group) => total + group.plannedCount, 0),
    writtenCount: groups.reduce((total, group) => total + group.writtenCount, 0),
    availableCodeCount: groups.filter((group) => group.writtenCount > 0).length,
  };
}
