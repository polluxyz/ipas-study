/** 本機備考原型：內容從專案共用資料夾載入，搜尋沿用 Starlight 的 Pagefind。 */
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import wikiLinks from './plugins/wiki-links.mjs';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import figures from './plugins/figures.mjs';
import asides from './plugins/asides.mjs';
import { supplementSections } from './plugins/supplement.mjs';
import { mathSearchPolicy, collapseAdvanced, readableTables } from './plugins/textbook.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import { unified } from '@astrojs/markdown-remark';

const codeFile = new URL('../content/codes/L23303.md', import.meta.url);
const routeData = existsSync(codeFile) ? parse(readFileSync(codeFile, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '') : undefined;
const route = routeData?.concepts ?? [];
const conceptLinks = route.filter((id) => existsSync(new URL(`../content/concepts/${id}.md`, import.meta.url))).map((id) => {
  const file = new URL(`../content/concepts/${id}.md`, import.meta.url);
  const title = existsSync(file) ? parse(readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '')?.title : id;
  return { label: title, link: `/concepts/${id}/` };
});
const chapterNumbers = ['一', '二', '三', '四', '五', '六'];
const chapterLinks = (routeData?.stages ?? []).map((stage, index) => ({
  label: `${chapterNumbers[index] ?? index + 1}、${stage.title}`,
  collapsed: true,
  items: stage.concepts.flatMap(({ id }) => conceptLinks.filter((link) => link.link === `/concepts/${id}/`)),
}));

export default defineConfig({
  integrations: [starlight({
    title: 'AI 學習手札',
    description: 'iPAS AI 應用規劃師中級｜科目 1・科目 3',
    defaultLocale: 'root',
    locales: { root: { label: '繁體中文', lang: 'zh-TW' } },
    customCss: ['./src/styles/custom.css', 'katex/dist/katex.min.css', './src/styles/math-figures.css'],
    components: { SiteTitle: './src/components/Brand.astro', ThemeSelect: './src/components/LightTheme.astro', Search: './src/components/Search.astro' },
    sidebar: [
      { label: '學習總覽', link: '/', attrs: { 'data-icon': 'home' } },
      { label: '概念目錄', link: '/catalog/' },
      { label: '概念地圖', link: '/map/' },
      { label: '我的錯題本', link: '/wrong-book/' },
      { label: '科目 3・機器學習', items: [
        { label: 'L23303 訓練、評估與驗證', link: '/codes/L23303/' },
        { label: '開始小測驗', link: '/quiz/' },
      ] },
      { label: '本次學習路線', items: chapterLinks.length ? chapterLinks : conceptLinks },
    ],
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 2 },
    social: [],
    credits: false,
    pagination: false,
    editLink: undefined,
  })],
  markdown: { processor: unified({
    remarkPlugins: [asides, remarkMath, wikiLinks, figures],
    rehypePlugins: [[rehypeKatex, { output: 'htmlAndMathml', trust: false, strict: 'warn' }], mathSearchPolicy, supplementSections, collapseAdvanced, readableTables],
  }) },
  vite: { server: { fs: { allow: ['..'] } } },
});
