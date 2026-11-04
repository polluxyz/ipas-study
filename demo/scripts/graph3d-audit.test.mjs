/** 大小計算必須包含動態模組與共用依賴，不能漏掉Vite的反引號。 */
import { describe, it, expect } from 'vitest';
import { moduleRefs, removePanel } from './graph3d-audit.mjs';
describe('3D產物量測邊界', () => {
  it('全量含三種引號與動態模組', () => { expect(moduleRefs('import{a}from"./a.js";import(\'./b.js\');import(`./c.js`);')).toEqual(['./a.js', './b.js', './c.js']); });
  it('初始loader只含靜態依賴', () => { expect(moduleRefs('import{a}from"./a.js";import(`./c.js`);', false)).toEqual(['./a.js']); });
  it('HTML差值完整移除巢狀面板而保留原正文', () => { expect(removePanel('<main>正文<details class="graph3d"><summary>圖</summary><details>清單</details></details><table>原表</table></main>')).toBe('<main>正文<table>原表</table></main>'); });
});
