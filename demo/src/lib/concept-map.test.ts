/** 驗證兩層連線的資料邊界，避免地圖把正文誤當成正式關係或重複計數。 */
import { describe, expect, it } from 'vitest';
import { buildConceptMap, type MapConcept } from './concept-map';
function concept(id: string, body = ''): MapConcept {
  return { data: { id, title: id.toUpperCase(), aliases: [], kind: 'technique', is_a: [], part_of: [], requires: [], mitigates: [], contrasts: [] }, body };
}
const stages = [{ id: 'stage', title: '階段', concepts: ['a', 'b', 'c'].map((id) => ({ id, goal: '理解' })) }];
describe('概念地圖資料', () => {
  it('保留方向、平行類型、註記與來源，排除反向正文重複線', () => {
    const a = concept('a', '[[b]]'); const b = concept('b', '[[a]]');
    a.data.requires = ['b']; a.data.contrasts = [{ target: 'b', note: '差異', source: ['guide-3:5-1'] }];
    const map = buildConceptMap([a, b], stages);
    expect(map.nodes).toHaveLength(2); expect(map.edges).toHaveLength(2);
    expect(map.edges[0]).toMatchObject({ source: 'a', target: 'b', type: 'requires' });
    expect(map.edges[1]).toMatchObject({ note: '差異', sources: ['guide-3:5-1'] });
  });
  it('解析唯一別名與標題，雙向正文只畫一線，略過自己與程式碼', () => {
    const a = concept('a', '[[別名]] [[B]] [[a]] `[[c]]`'); const b = concept('b', '[[a]]');
    b.data.aliases = ['別名'];
    const map = buildConceptMap([a, b, concept('c')], stages);
    expect(map.edges).toHaveLength(1); expect(map.edges[0].type).toBe('body');
  });
  it('略過歧義別名、不存在與範圍外目標', () => {
    const a = concept('a', '[[重名]] [[missing]] [[outside]]');
    const b = concept('b'); const c = concept('c'); b.data.aliases = ['重名']; c.data.aliases = ['重名'];
    a.data.requires = ['outside'];
    expect(buildConceptMap([a, b, c, concept('outside')], stages).edges).toEqual([]);
  });
});
