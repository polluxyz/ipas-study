/** 用既有概念名稱補足斷詞漏失；原查詢與 Pagefind 全文結果保持原樣。 */
export interface SearchTitle {
  id: string;
  title: string;
  aliases: string[];
  summary?: string;
}

export function findSearchTitles(query: string, entries: readonly SearchTitle[]): SearchTitle[] {
  const term = query.normalize('NFC').trim().toLowerCase();
  // 比對完整名稱，不拆字、不刪字，也不改寫送往 Pagefind 的輸入。
  if (!term) return [];
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id) || ![entry.title, ...entry.aliases].some((name) => name.normalize('NFC').toLowerCase() === term)) return false;
    seen.add(entry.id);
    return true;
  });
}

export function findSearchSummary(href: string, baseUrl: string, entries: readonly SearchTitle[]): string | undefined {
  try {
    const url = new URL(href, baseUrl);
    if (url.origin !== new URL(baseUrl).origin) return undefined;
    const entry = entries.find(({ id }) => url.pathname.replace(/\/$/, '') === `/concepts/${encodeURIComponent(id)}`);
    return entry?.summary?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function bindSearchSummaryFallback(root: HTMLElement, entries: readonly SearchTitle[]): () => void {
  const update = () => {
    // 清單只在 Pagefind 完成搜尋後出現；載入中的列沒有可用的頁面連結。
    for (const row of root.querySelectorAll<HTMLElement>('.pagefind-ui__results > li > .pagefind-ui__result-inner')) {
      const link = row.querySelector<HTMLAnchorElement>(':scope > .pagefind-ui__result-title > a');
      const fallback = row.querySelector<HTMLElement>('[data-search-summary-fallback]');
      const original = [...row.querySelectorAll<HTMLElement>('.pagefind-ui__result-excerpt:not([data-search-summary-fallback])')];
      if (!link || original.some((excerpt) => excerpt.textContent?.trim())) {
        fallback?.remove();
        continue;
      }
      const summary = findSearchSummary(link.href, root.ownerDocument.baseURI, entries);
      if (!summary) { fallback?.remove(); continue; }
      if (fallback) {
        if (fallback.textContent !== summary) fallback.textContent = summary;
        continue;
      }
      // 只補真實概念摘要，不更動原摘要、連結、排名或結果計數。
      const excerpt = document.createElement('p');
      excerpt.className = 'pagefind-ui__result-excerpt';
      excerpt.dataset.searchSummaryFallback = '';
      excerpt.textContent = summary;
      link.parentElement?.insertAdjacentElement('afterend', excerpt);
    }
  };
  const observer = new MutationObserver(update);
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href'] });
  update();
  return () => {
    observer.disconnect();
    for (const excerpt of root.querySelectorAll('[data-search-summary-fallback]')) excerpt.remove();
  };
}

export function bindSearchTitles(root: HTMLElement, entries: readonly SearchTitle[]): () => void {
  const removeSummaryFallback = bindSearchSummaryFallback(root, entries);
  const panel = document.createElement('section');
  panel.className = 'search-title-matches';
  panel.dataset.searchTitleMatches = '';
  panel.setAttribute('aria-label', '符合名稱的概念');
  panel.hidden = true;
  const heading = document.createElement('p');
  heading.textContent = '符合名稱的概念';
  const list = document.createElement('ul');
  panel.append(heading, list);
  let renderedTerm: string | null = null;

  const update = () => {
    if (composing) return;
    const input = root.querySelector<HTMLInputElement>('.pagefind-ui__search-input');
    const form = input?.closest('form');
    if (!input || !form) return;
    // 接在原輸入欄與清除鈕之後，不移動或改寫 Pagefind 管理的節點。
    if (!panel.isConnected) form.insertBefore(panel, form.querySelector('.pagefind-ui__drawer'));
    // Tab 等按鍵不能重建目前連結，否則瀏覽器會遺失鍵盤焦點。
    if (input.value === renderedTerm) return;
    renderedTerm = input.value;
    panel.dataset.searchTitleQuery = input.value;
    const matches = findSearchTitles(input.value, entries);
    list.replaceChildren(...matches.map((entry) => {
      const row = document.createElement('li');
      const link = document.createElement('a');
      link.href = `/concepts/${encodeURIComponent(entry.id)}/`;
      link.dataset.searchTitleLink = '';
      link.textContent = entry.title;
      row.append(link);
      if (entry.summary) {
        const summary = document.createElement('p');
        summary.className = 'search-title-summary';
        summary.dataset.searchTitleSummary = '';
        summary.textContent = entry.summary;
        row.append(summary);
      }
      return row;
    }));
    panel.hidden = matches.length === 0;
  };

  let composing = false;
  const onInput = () => { if (!composing) update(); };
  const onStart = () => {
    composing = true;
    renderedTerm = null;
    delete panel.dataset.searchTitleQuery;
    panel.hidden = true;
  };
  const onEnd = () => { composing = false; update(); };
  // 清除鈕與 Escape 的原處理器先更新輸入值，再重算名稱入口。
  const onControl = () => queueMicrotask(update);
  root.addEventListener('input', onInput);
  root.addEventListener('compositionstart', onStart);
  root.addEventListener('compositionend', onEnd);
  root.addEventListener('click', onControl);
  root.addEventListener('keydown', onControl);
  return () => {
    root.removeEventListener('input', onInput);
    root.removeEventListener('compositionstart', onStart);
    root.removeEventListener('compositionend', onEnd);
    root.removeEventListener('click', onControl);
    root.removeEventListener('keydown', onControl);
    removeSummaryFallback();
    panel.remove();
  };
}
