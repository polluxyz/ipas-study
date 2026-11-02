/** 以最小 DOM 替身檢查開關狀態、目錄同步與復原，實際可見範圍另由 smoke 驗收。 */
import { describe, expect, it } from 'vitest';
import { bindSupplementFilter } from './supplement-filter';
function fixture(hasBlocks = true) {
  const heading = { id: '延伸細節' };
  const block = { id: '', hidden: false, querySelectorAll: () => [heading] };
  const row = { id: '', hidden: true, querySelectorAll: () => [] };
  const toc = { hidden: false };
  const unrelated = { hidden: false };
  let changed = () => {};
  const toggle = { checked: true, getAttribute: () => 'body', addEventListener: (_name: string, listener: () => void) => { changed = listener; } };
  const status = { textContent: '' };
  const control = { hidden: true, querySelector: (selector: string) => selector === '[data-guide-only]' ? toggle : status };
  const target = { querySelectorAll: () => hasBlocks ? [block, row] : [] };
  const root = {
    querySelector: () => target,
    querySelectorAll: () => [
      { hash: '#' + encodeURIComponent('延伸細節'), closest: () => toc },
      { hash: '#指引內容', closest: () => unrelated },
    ],
  };
  bindSupplementFilter(control as unknown as HTMLElement, root as unknown as ParentNode);
  return { control, toggle, status, block, row, toc, unrelated, change: () => changed() };
}
describe('補充開關', () => {
  it('預設關閉，不沿用瀏覽器復原的 checked 狀態', () => {
    const view = fixture();
    expect(view.control.hidden).toBe(false); expect(view.toggle.checked).toBe(false);
    expect(view.block.hidden).toBe(false); expect(view.status.textContent).toBe('目前顯示：指引＋補充');
  });
  it('開啟隱藏區塊與編碼錨點的目錄，關閉時還原，原本隱藏的列保持隱藏', () => {
    const view = fixture(); view.toggle.checked = true; view.change();
    expect(view.block.hidden).toBe(true); expect(view.toc.hidden).toBe(true); expect(view.unrelated.hidden).toBe(false);
    expect(view.status.textContent).toContain('僅指引內容');
    view.toggle.checked = false; view.change();
    expect(view.block.hidden).toBe(false); expect(view.toc.hidden).toBe(false); expect(view.row.hidden).toBe(true);
  });
  it('沒有補充內容就隱藏開關', () => { expect(fixture(false).control.hidden).toBe(true); });
});
