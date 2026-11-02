/** 僅控制當頁的補充可見性；保留原始 hidden 狀態，離開頁面即恢復預設。 */
export function bindSupplementFilter(control: HTMLElement, root: ParentNode = document): void {
  const toggle = control.querySelector<HTMLInputElement>('[data-guide-only]');
  const targetId = toggle?.getAttribute('aria-controls');
  const target = targetId ? root.querySelector<HTMLElement>(`[id="${targetId}"]`) : null;
  if (!toggle || !target) return;
  const blocks = [...target.querySelectorAll<HTMLElement>('[data-supplement]')];
  if (!blocks.length) { control.hidden = true; return; }
  control.hidden = false;
  const ids = new Set(blocks.flatMap((block) => [...block.querySelectorAll<HTMLElement>('[id]'), ...(block.id ? [block] : [])].map((node) => node.id)));
  const links = [...root.querySelectorAll<HTMLAnchorElement>('starlight-toc a[href], mobile-starlight-toc a[href], [data-supplement-toc] a[href]')]
    .filter((link) => ids.has(decodeURIComponent(link.hash.slice(1))))
    .map((link) => link.closest<HTMLElement>('li') ?? link);
  const targets = [...new Set([...blocks, ...links])];
  const original = new Map(targets.map((element) => [element, element.hidden]));
  const update = () => {
    for (const element of targets) element.hidden = toggle.checked || original.get(element) === true;
    const status = control.querySelector<HTMLElement>('[data-filter-status]');
    if (status) status.textContent = toggle.checked ? '目前顯示：僅指引內容（已隱藏補充）' : '目前顯示：指引＋補充';
  };
  toggle.checked = false; update(); toggle.addEventListener('change', update);
}
