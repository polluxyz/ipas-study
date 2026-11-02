/** 同一條關係在兩端都應保留考題依據，且教材來源不能因此漏出題號。 */
import { describe, expect, it } from 'vitest';
import { relatedPastQuestionIds, splitSources } from './relation-sources';

describe('來源分流', () => {
  it('只有考題時不產生指引來源', () => {
    expect(splitSources(['114-2-S1-Q10'])).toEqual({ guideSources: [], questionIds: ['114-2-S1-Q10'] });
  });
  it('只有指引時保留科目與頁碼', () => {
    expect(splitSources(['guide-1:3-51', 'guide-3:5-21'])).toEqual({ guideSources: ['guide-1:3-51', 'guide-3:5-21'], questionIds: [] });
  });
  it('混合來源時分開列出並保留各自順序', () => {
    expect(splitSources(['guide-3:5-21', '114-2-S1-Q10', '115-1-S3-Q12'])).toEqual({ guideSources: ['guide-3:5-21'], questionIds: ['114-2-S1-Q10', '115-1-S3-Q12'] });
  });
  it('空來源或其他字串不會變成考題連結', () => {
    expect(splitSources([])).toEqual({ guideSources: [], questionIds: [] });
    expect(splitSources(['https://example.org', 'not-a-question'])).toEqual({ guideSources: [], questionIds: [] });
  });
});

describe('概念頁相關考古題', () => {
  const concepts = [
    { id: 'method', mitigates: [{ target: 'problem', source: ['guide-3:5-27', '115-1-S3-Q45'] }], contrasts: [{ target: 'alternative', source: ['114-2-S3-Q34'] }] },
    { id: 'unrelated', mitigates: [{ target: 'other', source: ['115-1-S3-Q01'] }], contrasts: [] },
  ];
  it('正向關係包含對策及比較來源，排除無關概念', () => {
    expect(relatedPastQuestionIds('method', concepts)).toEqual(['115-1-S3-Q45', '114-2-S3-Q34']);
  });
  it('反向的對策表及比較表都取得引用題目', () => {
    expect(relatedPastQuestionIds('problem', concepts)).toEqual(['115-1-S3-Q45']);
    expect(relatedPastQuestionIds('alternative', concepts)).toEqual(['114-2-S3-Q34']);
  });
  it('既有清單、重複關係與教材對照的同題只列一次，不改動輸入', () => {
    const related = ['115-1-S3-Q45', '115-1-S3-Q45'];
    const duplicated = [...concepts, concepts[0]];
    const before = JSON.stringify(duplicated);
    expect(relatedPastQuestionIds('method', duplicated, related, ['114-2-S3-Q34', '114-2-S1-Q10'])).toEqual(['115-1-S3-Q45', '114-2-S3-Q34', '114-2-S1-Q10']);
    expect(related).toHaveLength(2);
    expect(JSON.stringify(duplicated)).toBe(before);
  });
});
