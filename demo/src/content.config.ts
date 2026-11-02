/** 共用內容保留在 ../content；在網站邊界驗證規格必要欄位，不複製或改寫教材。 */
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

const relation = z.object({ target: z.string(), note: z.string().optional(), source: z.array(z.string()) });
const selfCheck = z.discriminatedUnion('type', [
  z.object({ id: z.string(), goal: z.string(), type: z.literal('choice'), prompt: z.string(), options: z.record(z.string(), z.string()), answer: z.string(), explain: z.record(z.string(), z.string()) }),
  z.object({ id: z.string(), goal: z.string(), type: z.literal('short'), prompt: z.string(), key_points: z.array(z.string()) }),
]);
const concepts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: '../content/concepts' }),
  schema: z.object({
    id: z.string(), title: z.string(), aliases: z.array(z.string()).default([]), kind: z.string(),
    codes: z.array(z.string()), guide_refs: z.array(z.string()).default([]),
    requires: z.array(z.string()).default([]), is_a: z.array(z.string()).default([]), part_of: z.array(z.string()).default([]),
    mitigates: z.array(relation).default([]), contrasts: z.array(relation.extend({ note: z.string() })).default([]),
    status: z.string().optional(),
    summary: z.string().optional(), goals: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
    self_check: z.array(selfCheck).optional(),
    formula_groups: z.array(z.object({ id: z.string(), source: z.string(), status: z.enum(['pending', 'verified']), checked_by: z.string().nullable().optional() })).optional(),
  }).loose(),
});
const codes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: '../content/codes' }),
  schema: z.object({
    code: z.string(), subject: z.number(), title: z.string(), guide_section: z.string(), concepts: z.array(z.string()),
    stages: z.array(z.object({ id: z.string(), title: z.string(), intro: z.string().optional(), concepts: z.array(z.object({ id: z.string(), goal: z.string() })) })).optional(),
  }).loose(),
});
const choice = z.enum(['A', 'B', 'C', 'D']);
const cheatsheetSchema = z.object({ code: z.string().regex(/^L2[13]\d{3}$/), title: z.string().trim().min(1) });
const cheatsheets = defineCollection({ loader: glob({ pattern: '**/*.md', base: '../content/cheatsheets' }), schema: cheatsheetSchema });
// 假教材用不同集合，切換驗證建置時不和正式檔案共用 glob 快取。
const cheatsheetFixtures = defineCollection({
  loader: process.env.TEXTBOOK_TEST_FIXTURES === '1' ? glob({ pattern: '**/*.md', base: './scripts/check-textbook/fixtures/cheatsheets' }) : async () => [],
  schema: cheatsheetSchema,
});
const questions = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml}', base: '../content/questions' }),
  schema: z.object({
    id: z.string(), rev: z.number().int().positive(), source: z.enum(['exam', 'guide', 'mock']),
    session: z.string().optional(), subject: z.number(), number: z.number().optional(), type: z.string(),
    codes: z.array(z.string()), concepts: z.array(z.string()), stem: z.string(), code: z.string().optional(), code_lang: z.string().optional(), image: z.string().optional(),
    options: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }), answer: choice,
    explanation: z.object({ summary: z.string(), correct: z.string(), wrong: z.record(z.string(), z.string()), rule: z.string().optional() }),
    guide_refs: z.array(z.string()).default([]),
    review: z.object({ status: z.enum(['draft', 'verified', 'disputed']), dispute: z.unknown().optional() }).loose(),
  }).loose(),
});
export const collections = { docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }), concepts, codes, questions, cheatsheets, cheatsheetFixtures };
