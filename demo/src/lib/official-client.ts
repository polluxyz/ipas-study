/** 官方練習只還原同份題組的作答；索引與題組沿用同一套進度計算。 */
import { getAttempts } from './attempts';
import { officialProgress, type OfficialQuestion } from './official';
import { initQuestionSet } from './question-set-client';

interface CatalogSet { id: string; mode: string; session: string; questions: Pick<OfficialQuestion, 'id'>[]; }
export function initOfficialIndex(): void {
  const status = document.getElementById('official-status')!;
  try {
    const sets: CatalogSet[] = JSON.parse(document.getElementById('official-catalog')!.textContent ?? '[]');
    const attempts = getAttempts();
    for (const set of sets) {
      const progress = officialProgress(set.questions, attempts, set.mode);
      document.getElementById(`progress-${set.id}`)!.textContent = `已答 ${progress.done}／${progress.total} 題・答對 ${progress.correct} 題`;
    }
    status.textContent = '各份題組分開計算進度。其他練習的作答不計入這裡。';
  } catch (cause) { status.textContent = `無法讀取進度：${cause instanceof Error ? cause.message : '請確認瀏覽器允許本機儲存。'}`; }
}

export function initOfficial(): void {
  const status = document.getElementById('official-status')!;
  try {
    const set: CatalogSet = JSON.parse(document.getElementById('official-catalog')!.textContent ?? '{}');
    const progress = officialProgress(set.questions, getAttempts(), set.mode);
    const cards = Array.from(document.querySelectorAll<HTMLElement>('#official-cards [data-question]'));
    document.getElementById('official-practice')!.hidden = !cards.length;
    status.textContent = `本份共 ${cards.length} 題，作答後立即顯示解析。重新整理會保留已儲存的作答與目前位置。`;
    initQuestionSet({ prefix: 'official', cards, answered: progress.answered, mode: set.mode, elapsed: progress.elapsed, exam: set.session !== 'guide' });
  } catch (cause) { status.textContent = `無法載入官方題組：${cause instanceof Error ? cause.message : '請確認瀏覽器允許本機儲存。'}`; }
}
