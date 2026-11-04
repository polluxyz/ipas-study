/** 互動控制保留中心與選取高亮的差別；失敗時保留SSR文字，不採其他版本資料。 */
import { graphStore } from './graph3d-loader';
import { initialState, parseShared, sharedUrl, visibleGraph } from './graph3d-model';
import { GraphRenderer } from './graph3d-renderer';
import { getReadings } from './attempts';
import { TYPES, type GraphData, type GraphState, type GraphVersion, type SharedState } from './graph3d-types';
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
  function inspect(id: string) {
    if (!alive || paused || !data?.concepts.some((node) => node.id === id)) return;
    state.inspected = id;
    const visible = view(); renderer?.update(visible.nodes, visible.edges, state);
  }
  function inspectUnit(id: string) {
    if (!alive || paused || !data?.units.some((unit) => unit.id === id)) return;
    state.inspected = id;
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
  }
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
        case 'reset': { state = initialState(localId); shared = false; writeUrl(); refresh(true); renderer?.reset(); if (localId) inspect(localId); break; }
        case 'home': setCenter(localId); break;
        case 'touch': touch = !touch; renderer?.setTouch(touch); target.setAttribute('aria-pressed', String(touch)); target.textContent = touch ? '關閉觸控旋轉' : '開啟觸控旋轉'; break;
      }
    }, { signal });
    role<HTMLSelectElement>('hops').addEventListener('change', () => { const hops = Number(role<HTMLSelectElement>('hops').value); if (hops && data?.concepts.some((node) => node.id === state.inspected)) { state.hops = hops; setCenter(state.inspected); } else { state.hops = hops; exitSharing(); refresh(true); } }, { signal });
    role<HTMLInputElement>('body').addEventListener('change', () => { state.body = role<HTMLInputElement>('body').checked; writeUrl(); refresh(true); if (state.inspected) inspect(state.inspected); }, { signal });
    role<HTMLButtonElement>('retry').addEventListener('click', () => { if (retryUsed) return; retryUsed = true; role<HTMLButtonElement>('retry').disabled = true; failed = false; void load(true); }, { signal });
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
        results.append(el('p', `${matches.length}個符合概念${matches.length > 12 ? '，先列前12個；請輸入更完整的名稱或ID。' : ''}`));
        for (const node of matches.slice(0, 12)) {
          const button = el('button', node.title); button.type = 'button'; button.append(el('small', `${node.owner} · ${node.id}`));
          button.addEventListener('click', () => {
            const inScope = (state.subject === 'all' || node.subjects.includes(Number(state.subject))) && (state.unit === 'all' || node.codes.includes(state.unit));
            if (!inScope) { exitSharing(); state.subject = 'all'; state.unit = 'all'; state.hops = 0; }
            state.mode = 'concept'; state.inspected = node.id; state.center = node.id; if (shared) writeUrl(); results.hidden = true; search.value = node.title; refresh(true); inspect(node.id); role('canvas').focus({ preventScroll: true }); status(`已選取「${node.title}」。${inScope ? '' : '已切回全站範圍。'}`);
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
    status(renderer.available ? '圖資料已載入。移至節點查看完整資訊；點選可保留高亮，再用鄰接範圍切換中心。' : '瀏覽器無法建立畫布。請使用文字入口與原關係表。');
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
