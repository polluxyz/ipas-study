/** 直接渲染題卡，保護爭議來源連結、ASCII、公式與不同題目來源的答案標籤。 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { getViteConfig } from 'astro/config';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parse } from 'yaml';

// 沿用 Astro 的編譯器與 Markdown 的 HTML parser，不新增測試相依。
const astroRequire = createRequire(import.meta.resolve('astro/config'));
const { createServer } = await import(pathToFileURL(astroRequire.resolve('vite')).href);
const markdownRequire = createRequire(import.meta.resolve('@astrojs/markdown-remark'));
const { fromHtml } = await import(pathToFileURL(markdownRequire.resolve('hast-util-from-html')).href);
const question = parse(readFileSync(new URL('../../../content/questions/exam/115-1/115-1-S3-Q30.yaml', import.meta.url), 'utf8'));
const origin = JSON.parse(readFileSync(new URL('../../../tests/fixtures/question-origin/valid.json', import.meta.url), 'utf8'));
const invalidOrigin = JSON.parse(readFileSync(new URL('../../../tests/fixtures/question-origin/invalid.json', import.meta.url), 'utf8'));
const tree = (html) => fromHtml(html, { fragment: true });
function all(node, predicate) { return [...(predicate(node) ? [node] : []), ...(node.children ?? []).flatMap((child) => all(child, predicate))]; }
function textOf(node) { return node.value ?? (node.children ?? []).map(textOf).join(''); }
const withClass = (name) => (node) => node.properties?.className?.includes(name);
let server;
let component;
let container;
let questionSchema;
async function render(q) { return tree(await container.renderToString(component, { props: { question: q, titles: {} } })); }

beforeAll(async () => {
  // 僅啟動本行程的編譯環境，不監聽 HTTP 連接埠；測試結束時關閉。
  const config = await getViteConfig({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null } }, { configFile: false })({ mode: 'test', command: 'build' });
  server = await createServer(config);
  component = (await server.ssrLoadModule('/src/components/QuestionCard.astro')).default;
  questionSchema = (await server.ssrLoadModule('/src/content.config.ts')).questionSchema;
  container = await AstroContainer.create();
}, 30000);
afterAll(async () => { await server?.close(); });

describe('題卡來源與爭議說明', () => {
  it('外部題顯示原作者、固定版本來源、授權與修改摘要，保留參考答案', async () => {
    const fixture = { ...question, source: 'mock', answer: 'A', origin };
    const ast = await render(fixture);
    const attribution = all(ast, (node) => node.properties?.dataQuestionOrigin !== undefined);
    expect(attribution).toHaveLength(1);
    expect(textOf(attribution[0])).toContain(`原作者：${origin.author}`);
    expect(textOf(attribution[0])).toContain(`修改摘要：${origin.modified}`);
    expect(all(attribution[0], (node) => node.tagName === 'a').map((node) => [node.properties.href, textOf(node)])).toEqual([
      [`${origin.repo}/blob/${origin.commit}/${origin.path}`, '原題來源（固定版本）'],
      [origin.license_url, origin.license],
    ]);
    const result = all(ast, withClass('answer-result'))[0];
    expect(textOf(result)).toContain(`參考答案 ${fixture.answer}`);
    expect(textOf(result)).not.toContain('官方答案');
  });

  it('沒有出處時不新增出處節點或文字', async () => {
    const ast = await render(question);
    expect(all(ast, (node) => node.properties?.dataQuestionOrigin !== undefined)).toHaveLength(0);
    expect(textOf(ast)).not.toContain('原作者：');
    expect(textOf(ast)).not.toContain('修改摘要：');
  });

  it.each(['exam', 'guide', 'mock'].flatMap((source) => ['verified', 'draft', 'disputed'].map((status) => [source, status])))('%s / %s 的題卡來源標籤一致，保留狀態、計分與 Markdown 來源', async (source, status) => {
    // 使用不含答案來源字樣的內容，讓整張題卡的來源誤標都能被檢查到。
    const label = source === 'mock' ? '參考答案' : '官方答案';
    const fixture = {
      ...question, id: `fixture-${source}-${status}`, source,
      stem: '比較不同資料切分的預測差異。',
      explanation: { summary: '辨識預測波動。', correct: '此處採用高變異。', wrong: { A: '不符合題意。', C: '另有適用條件。', D: '缺少所需證據。' }, rule: '先看題目證據。' },
      review: { status, dispute: '請核對 "r--"、--help... 與公式 $x^2$，並參閱[查證來源](https://example.com/reference)。' },
    };
    const ast = await render(fixture);
    const result = all(ast, withClass('answer-result'))[0];
    expect(textOf(result)).toContain(`${label} ${fixture.answer}`);
    expect(all(ast, (node) => node.properties?.dataAnswer === fixture.answer)).toHaveLength(1);
    expect(textOf(ast).includes('模擬題・待審查')).toBe(source === 'mock' && status === 'draft');
    if (source === 'mock') expect(textOf(ast)).not.toContain('官方答案');
    else expect(textOf(ast)).not.toContain('參考答案');
    const disputes = all(ast, withClass('dispute'));
    expect(disputes).toHaveLength(status === 'disputed' ? 1 : 0);
    if (status === 'disputed') {
      const dispute = disputes[0];
      expect(textOf(all(dispute, (node) => node.tagName === 'small')[0])).toBe(`此題依${label} ${fixture.answer} 計分，請一併理解上述實務限制。`);
      expect(textOf(ast)).toContain(`有爭議・依${label}計分`);
      expect(all(dispute, (node) => node.tagName === 'a').map((node) => [node.properties.href, textOf(node)])).toContainEqual(['https://example.com/reference', '查證來源']);
      expect(all(dispute, (node) => node.tagName === 'annotation').map(textOf)).toContain('x^2');
      expect(textOf(dispute)).toContain('"r--"、--help...');
    }
  });

  it.each([
    ['exam', '官方答案'], ['guide', '官方答案'], ['mock', '參考答案'],
  ])('%s 的答案標籤符合來源，答案值保持不變', async (source, label) => {
    const ast = await render({ ...question, source, review: { status: 'draft' } });
    const result = all(ast, withClass('answer-result'))[0];
    expect(textOf(result)).toContain(`${label} ${question.answer}`);
    expect(all(result, (node) => node.tagName === 'b').map(textOf)).toEqual([question.answer]);
    expect(all(ast, (node) => node.properties?.dataAnswer === question.answer)).toHaveLength(1);
    expect(textOf(ast).includes('模擬題・待審查')).toBe(source === 'mock');
    expect(all(ast, withClass('dispute'))).toHaveLength(0);
  });

  it('真實 Q30 的官方來源成為超連結，保留爭議計分說明', async () => {
    const ast = await render(question);
    const dispute = all(ast, withClass('dispute'))[0];
    expect(all(dispute, (node) => node.tagName === 'a').map((node) => [node.properties.href, textOf(node)])).toContainEqual([
      'https://scikit-learn.org/stable/auto_examples/ensemble/plot_bias_variance.html', 'scikit-learn 官方偏差與變異示例',
    ]);
    expect(textOf(dispute)).not.toContain('[scikit-learn');
    expect(textOf(dispute)).toContain(`此題依官方答案 ${question.answer} 計分`);
    expect(textOf(ast)).toContain('有爭議・依官方答案計分');
    expect(all(ast, withClass('option-content')).map((node) => textOf(node).trim())).toEqual(['A', 'B', 'C', 'D'].map((choice) => question.options[choice]));
    const reasons = all(ast, withClass('wrong-reasons'))[0];
    expect(all(reasons, (node) => node.tagName === 'dd').map((node) => textOf(node).trim())).toEqual(['A', 'C', 'D'].map((choice) => question.explanation.wrong[choice]));
  });

  it('爭議內容未填時仍能顯示原有計分說明', async () => {
    const ast = await render({ ...question, review: { status: 'disputed' } });
    const dispute = all(ast, withClass('dispute'))[0];
    expect(textOf(dispute)).toContain(`此題依官方答案 ${question.answer} 計分`);
    expect(textOf(dispute)).not.toContain('undefined');
  });

  it('爭議欄位沿用既有呈現：ASCII 原字元、數學及連結都保留', async () => {
    const disputeText = '格式 "b-"、\'r--\'，參數 --help...\n\n公式 $x^2$，參閱[來源](https://example.com/reference)。';
    const ast = await render({ ...question, review: { ...question.review, dispute: disputeText } });
    const dispute = all(ast, withClass('dispute'))[0];
    expect(textOf(dispute)).toContain('格式 "b-"、\'r--\'，參數 --help...');
    expect(all(dispute, (node) => node.tagName === 'annotation').map(textOf)).toContain('x^2');
    expect(all(dispute, (node) => node.tagName === 'a').some((node) => node.properties.href === 'https://example.com/reference')).toBe(true);
    expect(all(dispute, (node) => node.tagName === 'p').some((node) => all(node, (child) => child !== node && child.tagName === 'p').length > 0)).toBe(false);
  });
});

describe('題目出處驗證', () => {
  const external = () => ({ ...question, source: 'mock', answer: 'A', origin: structuredClone(origin) });
  it('接受完整出處與換算答案，也接受沒有出處的舊題', () => {
    expect(questionSchema.safeParse(external()).success).toBe(true);
    expect(questionSchema.safeParse(question).success).toBe(true);
    expect(questionSchema.parse(question)).not.toHaveProperty('origin');
  });
  it.each(invalidOrigin.missing_fields)('出處子欄位 %s 不可缺少', (field) => {
    const fixture = external();
    delete fixture.origin[field];
    expect(questionSchema.safeParse(fixture).success).toBe(false);
  });
  it.each(invalidOrigin.commits)('拒絕非法 commit：%s', (commit) => {
    const fixture = external(); fixture.origin.commit = commit;
    expect(questionSchema.safeParse(fixture).success).toBe(false);
  });
  it.each(invalidOrigin.licenses)('拒絕未授權的 license：%s', (license) => {
    const fixture = external(); fixture.origin.license = license;
    expect(questionSchema.safeParse(fixture).success).toBe(false);
  });
  it.each(invalidOrigin.option_maps)('拒絕非 A–D 一對一 option_map：%j', (option_map) => {
    const fixture = external(); fixture.origin.option_map = option_map;
    expect(questionSchema.safeParse(fixture).success).toBe(false);
  });
  it('拒絕答案換算不符，錯誤指向 answer', () => {
    const fixture = external(); fixture.answer = invalidOrigin.mismatched_answer;
    const result = questionSchema.safeParse(fixture);
    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'answer')).toBe(true);
  });
  it('原題答案只允許 A–D', () => {
    const fixture = external(); fixture.origin.original_answer = invalidOrigin.original_answer;
    expect(questionSchema.safeParse(fixture).success).toBe(false);
  });
});
