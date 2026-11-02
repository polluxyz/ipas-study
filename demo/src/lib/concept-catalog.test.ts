/** 以小型資料驗證主責代碼、實際頁數及 CSV 邊界，避免目錄重複收錄跨科概念或連到未寫頁面。 */
import { describe, expect, it } from 'vitest';
import { buildConceptCatalog, parseConceptIndex } from './concept-catalog';

const emptyCoverage = 'topic_id,concept_id\n';
const emptyTopics = 'topic_id,code,origin\n';
const header = 'id,title,kind,owner_code,codes,aliases\n';
const csv = header + [
  'first,第一頁,technique,L21201,L21201;L23302,別名',
  'planned,規劃頁,technique,L23302,L23302,',
  'second,第二頁,technique,L21201,L21201,',
  'sample,範例頁,technique,L23303,L23303,',
].join('\n');

const orderedIds = ['a-late', 'supp-late', 'unmapped-z', 'z-tie', 'a-tie', 'z-early', 'supp-early', 'mixed', 'foreign', 'unmapped-a', 'planned'];
const orderIndex = header + orderedIds.map((id) => `${id},${id},technique,L21101,L21101,`).join('\n');
const orderTopics = 'origin,note,topic_id,code\r\n' + [
  'guide,"正文,後段",L21101-T10-G01,L21101',
  'guide,較早對應,L21101-T07-G01,L21101',
  'guide,同鍵,L21101-T03-G01,L21101',
  'guide,最早,L21101-T02-G01,L21101',
  'guide,混合,L21101-T04-G01,L21101',
  'supplement,補充,L21101-T12-G01,L21101',
  'supplement,較早補充,L21101-T09-G01,L21101',
  'supplement,最早補充,L21101-T06-G01,L21101',
  'supplement,混合,L21101-T01-G01,L21101',
  'guide,其他代碼正文,L23202-T01-G01,L23202',
  'supplement,其他代碼補充,L23202-T01-G02,L23202',
].join('\r\n');
const orderCoverage = 'concept_id,note,topic_id\n' + [
  'a-late,"目標,一",L21101-T10-G01', 'a-late,目標二,L21101-T07-G01',
  'supp-late,目標一,L21101-T12-G01', 'supp-late,目標二,L21101-T09-G01',
  'z-tie,同鍵一,L21101-T03-G01', 'z-tie,重複目標,L21101-T03-G01', 'a-tie,同鍵二,L21101-T03-G01',
  'z-early,正文起點,L21101-T02-G01', 'supp-early,補充起點,L21101-T06-G01',
  'mixed,正文,L21101-T04-G01', 'mixed,補充,L21101-T01-G01',
  'foreign,其他代碼,L23202-T01-G01', 'unmapped-a,其他代碼,L23202-T01-G02',
  'supp-late,其他代碼正文,L23202-T01-G01', 'a-late,其他代碼較早主題,L23202-T01-G01',
  'planned,未寫頁,L21101-T02-G01',
].join('\n');

function orderedGroup() {
  const catalog = buildConceptCatalog(orderIndex, orderedIds.filter((id) => id !== 'planned').reverse(), orderCoverage, orderTopics);
  return catalog.subjects[0].groups[0];
}

describe('概念目錄', () => {
  it('正文採同代碼最小主題編號，按數值排序，混合來源的頁仍歸正文', () => {
    const group = orderedGroup();
    expect(group.guideConcepts.map(({ id }) => id)).toEqual(['z-early', 'z-tie', 'a-tie', 'mixed', 'a-late']);
    expect(group).toMatchObject({ plannedCount: 11, writtenCount: 10 });
  });

  it('只有同代碼補充主題的頁另列補充子清單，依最小編號排在正文後', () => {
    const group = orderedGroup();
    expect(group.supplementConcepts.map(({ id }) => id)).toEqual(['supp-early', 'supp-late']);
    expect(group.concepts.slice(0, 7)).toEqual([...group.guideConcepts, ...group.supplementConcepts]);
  });

  it('無對應頁放最後，同鍵與無對應頁皆保留總表順序', () => {
    const group = orderedGroup();
    expect(group.unmappedConcepts.map(({ id }) => id)).toEqual(['unmapped-z', 'foreign', 'unmapped-a']);
    expect(group.concepts.slice(-3)).toEqual(group.unmappedConcepts);
    expect(group.guideConcepts.slice(1, 3).map(({ id }) => id)).toEqual(['z-tie', 'a-tie']);
  });

  it('其他代碼的主題不影響本代碼的順序或正文與補充分類', () => {
    const group = orderedGroup();
    expect(group.guideConcepts.at(-1)?.id).toBe('a-late');
    expect(group.supplementConcepts.at(-1)?.id).toBe('supp-late');
    expect(group.unmappedConcepts.map(({ id }) => id)).toContain('foreign');
    expect(group.unmappedConcepts.map(({ id }) => id)).toContain('unmapped-a');
  });

  it('依 owner_code 分組，跨代碼概念只收錄一次，並保留 CSV 列順序', () => {
    const catalog = buildConceptCatalog(csv, ['second', 'first', 'sample'], emptyCoverage, emptyTopics);
    const groups = catalog.subjects.flatMap((subject) => subject.groups);
    expect(groups.find((group) => group.code === 'L21201')?.concepts.map((concept) => concept.id)).toEqual(['first', 'second']);
    expect(groups.find((group) => group.code === 'L23302')?.concepts).toEqual([]);
    expect(groups.find((group) => group.code === 'L21201')?.concepts[0]).toEqual({ id: 'first', title: '第一頁', href: '/concepts/first/' });
  });

  it('只算檔案清單中存在且列在總表的頁，分別計算規劃與已寫頁數', () => {
    const catalog = buildConceptCatalog(csv, new Set(['first', 'sample', 'unlisted']), emptyCoverage, emptyTopics);
    expect(catalog).toMatchObject({ plannedCount: 4, writtenCount: 2, availableCodeCount: 2 });
    expect(catalog.subjects[0].groups.find((group) => group.code === 'L21201')).toMatchObject({ plannedCount: 2, writtenCount: 1, href: '/catalog/#L21201' });
    expect(catalog.subjects[1].groups.find((group) => group.code === 'L23302')).toMatchObject({ plannedCount: 1, writtenCount: 0, href: null });
    expect(catalog.subjects[1].groups.find((group) => group.code === 'L23303')?.href).toBe('/codes/L23303/');
  });

  it('兩科 21 個評鑑代碼全部保留，零頁時沒有可點連結', () => {
    const catalog = buildConceptCatalog(header, [], emptyCoverage, emptyTopics);
    expect(catalog.subjects.map((subject) => subject.groups.length)).toEqual([9, 12]);
    expect(catalog).toMatchObject({ plannedCount: 0, writtenCount: 0, availableCodeCount: 0 });
    expect(catalog.subjects.flatMap((subject) => subject.groups).every((group) => group.href === null)).toBe(true);
  });

  it('解析 BOM、CRLF、含逗號的 aliases、引號跳脫及欄位內換行', () => {
    const quoted = '\uFEFFaliases,owner_code,title,id\r\n"別名,alias",L21201,"名稱,含逗號",first\r\n"含""引號""\n換行",L23303,"含""引號""",sample\r\n\r\n';
    expect(parseConceptIndex(quoted)).toEqual([
      { id: 'first', title: '名稱,含逗號', ownerCode: 'L21201' },
      { id: 'sample', title: '含"引號"', ownerCode: 'L23303' },
    ]);
    expect(buildConceptCatalog(quoted, ['sample', 'first'], emptyCoverage, emptyTopics).writtenCount).toBe(2);
  });

  it('缺必要欄位或引號未閉合時指出資料問題', () => {
    expect(() => parseConceptIndex('id,title\na,標題')).toThrow('owner_code');
    expect(() => parseConceptIndex(header + 'a,"未閉合')).toThrow('未閉合');
    expect(() => buildConceptCatalog(header + 'a,標題,technique,L99999,L99999,', ['a'], emptyCoverage, emptyTopics)).toThrow('主責代碼');
  });

  it('指引資料缺必要欄位或含無效主題時指出資料問題', () => {
    expect(() => buildConceptCatalog(header, [], 'topic_id\n', emptyTopics)).toThrow('concept_id');
    expect(() => buildConceptCatalog(header, [], emptyCoverage, 'topic_id,code\n')).toThrow('origin');
    expect(() => buildConceptCatalog(header, [], emptyCoverage, emptyTopics + 'L21101-invalid,L21101,guide')).toThrow('主題編號');
    expect(() => buildConceptCatalog(header, [], emptyCoverage, emptyTopics + 'L21101-T01-G01,L21101,unknown')).toThrow('主題來源');
  });
});
