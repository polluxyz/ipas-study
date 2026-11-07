/** 伺服器端依模組位置讀取同題內容檔，避免受啟動目錄影響。 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { parseQuestionDuplicates, type QuestionDuplicates } from './question-duplicates';

export function loadQuestionDuplicates(): QuestionDuplicates {
  const path = new URL('../../../content/question-duplicates.yaml', import.meta.url);
  return parseQuestionDuplicates(parse(readFileSync(path, 'utf8')));
}
