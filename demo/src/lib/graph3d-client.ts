/** 互動控制保留中心與明細的差別；失敗時保留SSR文字，不採其他版本資料。 */
import { graphStore } from './graph3d-loader';
import { initialState, parseShared, sharedUrl, visibleGraph } from './graph3d-model';
import { GraphRenderer } from './graph3d-renderer';
import { getReadings } from './attempts';
import { COLORS, LABELS, TYPES, type GraphData, type GraphEdge, type GraphState, type GraphVersion, type SharedState } from './graph3d-types';
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
export function mountGraph(root: HTMLDetailsElement, importRetryUsed = false) {
  const localId = root.dataset.local ?? '', expected: GraphVersion = { format: Number(root.dataset.format), head: root.dataset.head!, sourceHash: root.dataset.hash! };
  const role = <T extends HTMLElement = HTMLElement>(name: string) => root.querySelector<T>(`[data-role="${name}"]`)!;
  let subscription = graphStore().subscribe(root.dataset.url!, expected), data: GraphData | undefined, state: GraphState = initialState(localId), renderer: GraphRenderer | undefined;
  let life = 0, ui = 0, alive = true, paused = false, failed = false, retryUsed = importRetryUsed, loading = false, shared = false, touch = false, initialized = false;
  let events: AbortController | undefined;
  const status = (text: string) => { role('status').textContent = text; };
  const showFailure = (message: string) => { role('interactive').hidden = true; role('fallback').hidden = false; role<HTMLButtonElement>('retry').hidden = false; role<HTMLButtonElement>('retry').disabled = retryUsed; status(`${message} 請使用文字入口與原關係表。`); };
  const currentShare = (): SharedState | null => shared && state.center && (state.hops === 1 || state.hops === 2) ? { selected: state.center, hops: state.hops, body: state.body } : null;
  const writeUrl = () => { const url = sharedUrl(new URL(location.href), currentShare()); if (url.href !== location.href) history.replaceState(history.state, '', url); };
  const updateLink = () => { if (localId) role<HTMLAnchorElement>('map-link').href = sharedUrl(new URL(location.href), { selected: state.center, hops: state.hops === 2 ? 2 : 1, body: state.body }, '/map/').href; };
  function inspect(id: string, focus = false) {
    if (!alive || paused || !data) return; const node = data.concepts.find((item) => item.id === id); if (!node) return;
    state.inspected = id; const title = role('detail-title'); title.textContent = node.title;
    const detail = role('detail'); detail.replaceChildren(el('p', `${node.owner} · ${data.units.find((unit) => unit.id === node.owner)?.title ?? ''} · ${node.typedDegree}條直接正式關係`), el('p', node.summary));
    if (node.exception) detail.append(el('p', '核可閱讀入口：目前沒有正式關係，仍保留原閱讀路線。'));
    else if (!node.typedDegree) detail.append(el('p', '目前沒有正式關係。圖不會補造連線。'));
    const link = el('a', '閱讀概念原文'); link.href = `/concepts/${id}/`; detail.append(link);
    const center = el('button', '以此概念為中心'); center.type = 'button'; center.addEventListener('click', () => setCenter(id), { signal: events?.signal }); detail.append(document.createTextNode(' '), center);
    const direct = data.formalEdges.filter((e) => e.source === id || e.target === id), formal = el('details');
    formal.append(el('summary', `直接正式關係與來源（${direct.length}條，不受畫布開關影響）`));
    let formalFilled = false;
    formal.addEventListener('toggle', () => { if (alive && !paused && formal.isConnected && formal.open && !formalFilled) { formalFilled = true; for (const edge of direct) formal.append(edgeCard(edge)); } }, { signal: events?.signal }); detail.append(formal);
    const bodyEdges = data.bodyEdges.filter((e) => e.source === id || e.target === id);
    if (bodyEdges.length) { const body = el('details'); body.append(el('summary', `正文提到（輔助層）· ${bodyEdges.length}組`)); let filled = false; body.addEventListener('toggle', () => { if (alive && !paused && body.isConnected && body.open && !filled) { filled = true; for (const edge of bodyEdges) body.append(edgeCard(edge)); } }, { signal: events?.signal }); detail.append(body); }
    if (focus) { title.focus({ preventScroll: true }); title.scrollIntoView({ behavior: 'instant', block: 'nearest' }); }
    const visible = view(); renderer?.update(visible.nodes, visible.edges, state);
  }
  function nodeButton(id: string, focus = true) { const button = el('button', data?.concepts.find((node) => node.id === id)?.title ?? id); button.type = 'button'; button.addEventListener('click', () => inspect(id, focus), { signal: events?.signal }); return button; }
  function edgeCard(edge: GraphEdge): HTMLElement {
    const article = el('article'); article.className = 'g3-edge'; article.style.setProperty('--g3-color', COLORS[edge.type]);
    const h = el('div'); h.append(nodeButton(edge.source), document.createTextNode(` ${edge.type === 'body' ? '—' : edge.type === 'contrasts' ? '↔' : '→'} ${LABELS[edge.type]} `), nodeButton(edge.target)); article.append(h);
    if (edge.type === 'body') {
      article.append(el('p', '只表示正文提到，無箭頭，不作為正式前置。'));
      for (const mention of edge.origins) { const d = el('details'); d.append(el('summary', '正文提及來源'), el('p', `${mention.source} → ${mention.target}；${mention.origin.path}:${mention.origin.line}；SHA-256 ${mention.origin.sha256}`)); article.append(d); }
    } else {
      if (edge.note !== undefined) article.append(el('p', edge.note));
      article.append(el('p', state.enabled.has(edge.type) ? '畫布已開啟此類型。' : '畫布已隱藏此類型，來源仍保留。'));
      const guides = edge.sources.filter((source) => source.startsWith('guide-')), questions = edge.sources.filter((source) => !source.startsWith('guide-'));
      article.append(el('p', guides.length ? guides.map((s) => s.replace(/^guide-(\d):/, '指引科$1 p.')).join('、') : '此關係未附指引頁碼。'));
      if (questions.length) { const details = el('details'); details.append(el('summary', `考題來源（${questions.length}）`)); for (const id of questions) { const a = el('a', id); a.href = `/questions/${id}/`; details.append(a, el('br')); } article.append(details); }
      const sourceLink = el('a', '查看關係所在概念原文'); sourceLink.href = `/concepts/${edge.source}/#connections`; article.append(sourceLink);
      const origin = el('details'); origin.append(el('summary', '資料出處與簽章'), el('p', `${edge.origin.path}:${edge.origin.line}；SHA-256 ${edge.origin.sha256}`)); article.append(origin);
    }
    return article;
  }
  function inspectUnit(id: string) {
    if (!alive || paused) return;
    state.inspected = id;
    const unit = data!.units.find((u) => u.id === id)!; role('detail-title').textContent = `${id} · ${unit.title}`;
    const detail = role('detail'); detail.replaceChildren(el('p', `${unit.ownedCount}個負責概念／${unit.memberCount}個成員概念。聚合由原正式邊回算，不是第6種關係。`));
    for (const row of data!.unitAggregation.filter((r) => r.source === id || r.target === id)) {
      const d = el('details'); d.append(el('summary', `${row.source} ${row.type === 'contrasts' ? '↔' : '→'} ${row.target} · ${LABELS[row.type]} · ${row.count}條原始邊`));
      for (const edgeId of row.edgeIds) { const edge = data!.formalEdges.find((e) => e.id === edgeId)!; d.append(edgeCard(edge)); } detail.append(d);
    }
    const visible = view(); renderer?.update(visible.nodes, visible.edges, state);
  }
  function view() { return visibleGraph(data!, state); }
  function syncControls() {
    role<HTMLSelectElement>('hops').value = String(state.hops); role<HTMLInputElement>('body').checked = state.body; role<HTMLInputElement>('body').disabled = state.mode === 'unit';
    if (!localId) { role<HTMLSelectElement>('subject').value = state.subject; role<HTMLSelectElement>('unit').value = state.unit; role<HTMLSelectElement>('mode').value = state.mode; role<HTMLInputElement>('outside').checked = state.outside; for (const input of root.querySelectorAll<HTMLInputElement>('[data-type]')) input.checked = state.enabled.has(input.value as typeof TYPES[number]); }
  }
  function refresh(fit = false) {
    if (!data) return; syncControls(); updateLink();
    const result = view(), formal = result.edges.filter((edge) => edge.type !== 'body').length;
    role('center').textContent = state.center ? `圖中心：${data.concepts.find((n) => n.id === state.center)?.title ?? state.center} · ${state.hops ? state.hops + '跳鄰接' : '範圍全部'}${result.outside ? ` · 含${result.outside}個範圍外概念` : ''}` : '全站概念；可搜尋或點選概念。';
    role('count').textContent = `${state.mode === 'unit' ? `${new Set(result.nodes.map((node) => node.owner)).size}個單元 · ` : ''}${result.nodes.length}／${data.concepts.length}個概念 · ${formal}條正式關係${state.body && state.mode === 'concept' ? ` · ${result.edges.length - formal}組正文輔助` : ''}${state.mode === 'unit' ? ' · 按負責單元聚合' : ''}`;
    renderer?.update(result.nodes, result.edges, state, fit);
    role('list').replaceChildren();
    if (role('list').parentElement!.hasAttribute('open')) fillList();
    // 大量連線卡片等使用者展開文字區才建立，減少首次可操作時間。
    role('edges').replaceChildren();
    if (role('edges').parentElement instanceof HTMLDetailsElement && role('edges').parentElement!.hasAttribute('open')) fillEdges();
  }
  function fillList() { const list = el('ul'); for (const node of view().nodes) { const li = el('li'), link = el('a', '閱讀原文'); link.href = `/concepts/${node.id}/`; li.append(nodeButton(node.id), link); list.append(li); } role('list').replaceChildren(list); }
  function fillEdges() { role('edges').replaceChildren(...view().edges.map(edgeCard)); }
  function setCenter(id: string) {
    if (!alive || paused) return;
    state.center = id; state.inspected = id; state.hops = state.hops === 2 ? 2 : 1; state.mode = 'concept'; state.subject = 'all'; state.unit = 'all'; state.outside = true; state.enabled = new Set(TYPES); shared = true; writeUrl(); refresh(true); inspect(id);
    status(`已以「${data!.concepts.find((n) => n.id === id)!.title}」為中心。正文未換頁。`);
  }
  function exitSharing() { shared = false; writeUrl(); }
  function attach() {
    events?.abort(); events = new AbortController(); const signal = events.signal;
    root.addEventListener('click', (event) => {
      const target = (event.target as Element).closest<HTMLButtonElement>('[data-action]'); if (!target) return;
      switch (target.dataset.action) {
        case 'zoom-in': renderer?.zoom(1.2); break;
        case 'zoom-out': renderer?.zoom(1 / 1.2); break;
        case 'fit': renderer?.fit(); break;
        case 'reset': { state = initialState(localId); shared = false; writeUrl(); refresh(true); renderer?.reset(); if (localId) inspect(localId); else { role('detail-title').textContent = '選取概念查看明細'; role('detail').replaceChildren(); } break; }
        case 'home': setCenter(localId); break;
        case 'touch': touch = !touch; renderer?.setTouch(touch); target.setAttribute('aria-pressed', String(touch)); target.textContent = touch ? '關閉觸控旋轉' : '開啟觸控旋轉'; break;
      }
    }, { signal });
    role<HTMLSelectElement>('hops').addEventListener('change', () => { const hops = Number(role<HTMLSelectElement>('hops').value); if (hops && data?.concepts.some((node) => node.id === state.inspected)) { state.hops = hops; setCenter(state.inspected); } else { state.hops = hops; exitSharing(); refresh(true); } }, { signal });
    role<HTMLInputElement>('body').addEventListener('change', () => { state.body = role<HTMLInputElement>('body').checked; writeUrl(); refresh(true); if (state.inspected) inspect(state.inspected); }, { signal });
    role<HTMLButtonElement>('retry').addEventListener('click', () => { if (retryUsed) return; retryUsed = true; role<HTMLButtonElement>('retry').disabled = true; failed = false; void load(true); }, { signal });
    role('edges').parentElement!.addEventListener('toggle', () => { if (role('edges').parentElement!.hasAttribute('open') && data) fillEdges(); }, { signal });
    role('list').parentElement!.addEventListener('toggle', () => { if (role('list').parentElement!.hasAttribute('open') && data) fillList(); }, { signal });
    window.addEventListener('popstate', () => { if (!data) return; const value = parseShared(new URL(location.href), new Set(data.concepts.map((n) => n.id))); state = initialState(localId, value); shared = !!value; writeUrl(); refresh(true); if (state.inspected) inspect(state.inspected); }, { signal });
    document.addEventListener('click', (event) => { if (!(event.target as Element).closest('[data-reading-toggle]')) return; try { renderer?.setReadings(new Set(getReadings().map((reading) => reading.conceptId))); } catch { /* 閱讀紀錄錯誤由原按鈕回報。 */ } }, { signal });
    if (!localId) {
      for (const name of ['subject', 'unit', 'mode', 'outside']) role(name).addEventListener('change', () => {
        exitSharing();
        if (name === 'subject') { state.subject = role<HTMLSelectElement>(name).value; state.unit = 'all'; }
        else if (name === 'unit') state.unit = role<HTMLSelectElement>(name).value;
        else if (name === 'mode') { state.mode = role<HTMLSelectElement>(name).value as 'concept' | 'unit'; state.center = ''; state.hops = 0; }
        else state.outside = role<HTMLInputElement>(name).checked;
        refresh(true);
      }, { signal });
      for (const input of root.querySelectorAll<HTMLInputElement>('[data-type]')) input.addEventListener('change', () => { exitSharing(); if (input.checked) state.enabled.add(input.value as typeof TYPES[number]); else state.enabled.delete(input.value as typeof TYPES[number]); refresh(); if (state.inspected) inspect(state.inspected); }, { signal });
      const search = role<HTMLInputElement>('search'), results = role('results');
      search.addEventListener('input', () => {
        const query = search.value.trim().toLocaleLowerCase(); results.replaceChildren(); results.hidden = !query; if (!query) return;
        const matches = data!.concepts.filter((n) => [n.id, n.title, ...n.aliases].some((s) => s.toLocaleLowerCase().includes(query)));
        results.append(el('p', `${matches.length}個符合概念${matches.length > 12 ? '，先列前12個；完整入口見下方清單。' : ''}`));
        for (const node of matches.slice(0, 12)) {
          const button = el('button', node.title); button.type = 'button'; button.append(el('small', `${node.owner} · ${node.id}`));
          button.addEventListener('click', () => {
            const inScope = (state.subject === 'all' || node.subjects.includes(Number(state.subject))) && (state.unit === 'all' || node.codes.includes(state.unit));
            if (!inScope) { exitSharing(); state.subject = 'all'; state.unit = 'all'; state.hops = 0; }
            state.mode = 'concept'; state.inspected = node.id; state.center = node.id; if (shared) writeUrl(); results.hidden = true; search.value = node.title; refresh(true); inspect(node.id, true); status(`已選取「${node.title}」。${inScope ? '' : '已切回全站範圍。'}`);
          }, { signal }); results.append(button);
        }
      }, { signal });
      search.addEventListener('keydown', (event) => { if (event.key === 'Escape') results.hidden = true; if (event.key === 'ArrowDown') { event.preventDefault(); results.querySelector<HTMLButtonElement>('button')?.focus(); } }, { signal });
    }
  }
  function activate() {
    if (!data) return;
    if (!initialized) {
      const url = new URL(location.href), value = parseShared(url, new Set(data.concepts.map((node) => node.id)));
      state = initialState(localId, value); shared = !!value; initialized = true; writeUrl();
      if (localId && url.searchParams.has('selected') && !value) { root.open = false; return; }
    }
    if (!events || events.signal.aborted) attach();
    if (!renderer) {
      let readings = new Set<string>(); try { readings = new Set(getReadings().map((r) => r.conceptId)); } catch { /* 已讀資料不可用仍可閱讀圖。 */ }
      renderer = new GraphRenderer(role<HTMLCanvasElement>('canvas'), role('tooltip'), data, state, (id, unit) => { if (unit) inspectUnit(id); else inspect(id); }, () => { role<HTMLButtonElement>('interactive').querySelector<HTMLButtonElement>('[data-action=reset]')?.click(); }, readings);
      renderer.setTouch(touch); role('chart').hidden = !renderer.available;
      refresh(true); if (state.inspected) inspect(state.inspected);
    } else { renderer.setActive(true); }
    role('interactive').hidden = false; role('fallback').hidden = renderer.available; role('retry').hidden = true;
    status(renderer.available ? '圖資料已載入。點選只改明細；使用「以此概念為中心」改變鄰接。' : '瀏覽器無法建立畫布。明細、文字清單及原關係表仍可閱讀。');
  }
  async function load(retry = false) {
    const lifeToken = life, uiToken = ++ui; loading = true; status('正在載入同版圖資料。');
    try {
      const ready = await subscription.load(retry);
      if (!alive || paused || life !== lifeToken) return;
      data = ready;
      if (uiToken === ui && root.open) activate();
    } catch (cause) { if (alive && !paused && life === lifeToken) { failed = true; if (uiToken === ui && root.open) showFailure(cause instanceof Error ? cause.message : '圖資料無法載入。'); } }
    finally { if (life === lifeToken) loading = false; }
  }
  // 重試按鈕在載入前也必須有效；activate會以同一份控制事件取代。
  attach();
  return {
    open() { if (!alive || paused) return; if (data) activate(); else if (failed) showFailure('圖資料尚未可用。'); else void load(); },
    close() { ui++; renderer?.setActive(false); },
    pause() { paused = true; life++; ui++; if (loading) failed = true; loading = false; renderer?.destroy(); renderer = undefined; events?.abort(); subscription.release(); },
    resume() { if (!alive) return; paused = false; life++; subscription = graphStore().subscribe(root.dataset.url!, expected); attach(); try { data = subscription.ready(); } catch (cause) { failed = true; data = undefined; showFailure(cause instanceof Error ? cause.message : '圖資料版本不符。'); return; } if (data && root.open) activate(); else if (!data && root.open) { failed = true; showFailure('先前載入已暫停。'); } },
    destroy() { if (!alive) return; alive = false; life++; ui++; renderer?.destroy(); events?.abort(); subscription.release(); },
  };
}
