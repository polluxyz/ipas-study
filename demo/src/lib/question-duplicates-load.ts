/**
 * 伺服器端讀取同題內容檔。
 * 用 Vite 的 `?raw` 在建置時把檔案內容打包進來。不可依模組位置算路徑：
 * 打包後模組移到 `dist/.prerender/chunks/`，相對路徑會指到不存在的位置。
 */
import { parse } from 'yaml';
import raw from '../../../content/question-duplicates.yaml?raw';
import { parseQuestionDuplicates, type QuestionDuplicates } from './question-duplicates';

export function loadQuestionDuplicates(): QuestionDuplicates {
  return parseQuestionDuplicates(parse(raw));
}
