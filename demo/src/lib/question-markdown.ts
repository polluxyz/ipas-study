/** 題目沿用教材的 Markdown 管線，處理器在首次使用時建立並重用。 */
import { createMarkdownProcessor, markdownConfigDefaults, unified, type MarkdownRenderer } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import asides from '../../plugins/asides.mjs';
import wikiLinks from '../../plugins/wiki-links.mjs';
import figures from '../../plugins/figures.mjs';
import { supplementSections } from '../../plugins/supplement.mjs';
import { mathSearchPolicy, collapseAdvanced, readableTables } from '../../plugins/textbook.mjs';

let processor: Promise<MarkdownRenderer> | undefined;
export function renderQuestionMarkdown(source: string): Promise<string> {
  if (!processor) {
    // Astro 7 的 unified() 回傳 processor，外掛選項位於 options，而非頂層。
    const options = unified({
      // 保留題目原文的引號與連字號，避免改變程式字串與運算符號。
      smartypants: false,
      remarkPlugins: [asides, remarkMath, wikiLinks, figures],
      rehypePlugins: [[rehypeKatex, { output: 'htmlAndMathml', trust: false, strict: 'warn' }], mathSearchPolicy, supplementSections, collapseAdvanced, readableTables],
    }).options;
    processor = createMarkdownProcessor({ ...options, shikiConfig: {
      ...markdownConfigDefaults.shikiConfig,
      transformers: [{ name: 'question-code-language', pre(node) { node.properties['data-language'] = this.options.lang; } }],
    } });
  }
  // 每次都轉換，讓外掛檢查更新的概念詞彙，並為這次渲染建立獨立狀態。
  return processor.then((renderer) => renderer.render(source)).then(({ code }) => code);
}
