/** 收合頁面只安裝啟動器；展開才載入互動程式，離頁暫停不重設重試次數。 */
export function bootGraphs() {
  for (const root of document.querySelectorAll<HTMLDetailsElement>('[data-graph3d]')) {
    let controller: Awaited<ReturnType<typeof import('./graph3d-client')['mountGraph']>> | undefined;
    let importing: Promise<void> | undefined, alive = true, suspended = false, failed = false;
    const events = new AbortController(), status = root.querySelector<HTMLElement>('[data-role=status]')!, retry = root.querySelector<HTMLButtonElement>('[data-role=retry]')!, reload = root.querySelector<HTMLButtonElement>('[data-role=reload]')!;
    const moduleFailure = () => { failed = true; status.textContent = '互動程式無法載入。請重新載入本頁。文字入口與原關係表仍可閱讀。'; retry.hidden = true; reload.hidden = false; };
    const start = () => {
      if (!alive || suspended || failed || !root.open) return;
      if (controller) { controller.open(); return; }
      if (importing) return;
      importing = import('./graph3d-client').then(({ mountGraph }) => {
        if (!alive || suspended) return;
        controller = mountGraph(root); if (root.open) controller.open();
      }).catch(() => { if (alive && !suspended) moduleFailure(); }).finally(() => { importing = undefined; });
    };
    root.addEventListener('toggle', () => { if (root.open) start(); else controller?.close(); }, { signal: events.signal });
    reload.addEventListener('click', () => location.reload(), { signal: events.signal });
    const destroy = () => { if (!alive) return; alive = false; controller?.destroy(); events.abort(); observer.disconnect(); };
    window.addEventListener('pagehide', (event) => { if (event.persisted) { suspended = true; observer.disconnect(); controller?.pause(); } else destroy(); }, { signal: events.signal });
    window.addEventListener('pageshow', (event) => { if (event.persisted && alive) { suspended = false; observer.observe(document.body, { childList: true, subtree: true }); if (controller) controller.resume(); else if (root.open) moduleFailure(); } }, { signal: events.signal });
    const observer = new MutationObserver(() => { if (!root.isConnected) destroy(); }); observer.observe(document.body, { childList: true, subtree: true });
    const url = new URL(location.href), selected = url.searchParams.getAll('selected');
    if (selected.length === 1 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(selected[0])) root.open = true;
    else if (['selected', 'hops', 'body'].some((key) => url.searchParams.has(key))) { for (const key of ['selected', 'hops', 'body']) url.searchParams.delete(key); history.replaceState(history.state, '', url); }
    if (root.open) start();
  }
}
