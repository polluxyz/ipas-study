/** 僅供測試渲染與互動的假教材，不寫入正式 content 或作答紀錄。 */
import type { TextbookConcept } from '../textbook';
export const concept: TextbookConcept = {
  id: 'fixture-concept', title: '測試概念', summary: '用保留資料確認模型是否學會泛化。',
  goals: [{ id: 'g1', text: '分辨訓練資料與測試資料的用途' }],
  self_check: [
    { id: 'c1', goal: 'g1', type: 'choice', prompt: '哪份資料用來做最後一次評估？', options: { A: '訓練集', B: '測試集', C: '已反覆調參的驗證集' }, answer: 'B', explain: { A: '訓練集用來學習參數。', B: '保留測試集用來評估泛化。', C: '反覆調參後不適合當作最後的獨立評估。' } },
    { id: 'c2', goal: 'g1', type: 'short', prompt: '為什麼不應根據測試結果持續調參？', key_points: ['測試資訊會進入模型選擇。', '最後評估不再獨立。'] },
    { id: 'c3', goal: 'g1', type: 'choice', prompt: '哪份資料適合在開發期間選擇超參數？', options: { A: '驗證集', B: '最後保留的測試集', C: '訓練集的分數' }, answer: 'A', explain: { A: '驗證集協助比較候選模型。', B: '測試集保留到最後評估。', C: '訓練分數無法獨立反映泛化。' } },
  ],
};
export const stages = [{ id: 'fixture-stage', title: '先分清資料用途', intro: '先確認資料各自的角色，再安排訓練與評估。保留最後評估資料，讓模型選擇有清楚界線。', concepts: [{ id: concept.id, goal: '分清資料用途' }] }];
export const explanation = { rule: '最後評估使用未參與訓練與模型選擇的資料。' };
