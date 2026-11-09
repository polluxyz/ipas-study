/**
 * 每日題本瀏覽器測試的共用進入方式。
 *
 * 第 4 版起，`/daily/` 一律先顯示兩科題本目錄，要點某一本的連結才進入作答。
 * 3 支 daily 瀏覽器腳本都經過這裡進出題本，畫面結構改變時只需改這一檔。
 * 本檔只匯出函式，匯入時不開瀏覽器、不連網。
 */

/** 目錄已畫好：目錄區塊可見，或狀態列已顯示無法載入的原因。 */
export async function waitCatalog(page) {
  await page.waitForFunction(() => !document.querySelector('#daily-directory').hidden || /損壞|未知|失敗|無法|超過/.test(document.querySelector('#daily-status').textContent));
}

/** 帶 book 的畫面已畫好：作答／回看、需結束、已結束、找不到其中之一可見，或顯示錯誤。 */
export async function waitBooklet(page) {
  await page.waitForFunction(() => ['#daily-practice', '#daily-retire', '#daily-unavailable', '#daily-save-error'].some((selector) => !document.querySelector(selector).hidden) || /損壞|未知|失敗|無法|超過/.test(document.querySelector('#daily-status').textContent));
}

/** 開題本目錄。給 subject 時網址帶 `?subject=`，目錄會捲到該科區塊。 */
export async function openCatalog(page, base, subject) {
  await page.goto(base + '/daily/' + (subject ? '?subject=' + subject : ''));
  await waitCatalog(page);
}

/** 直接開指定題本的網址，不經過目錄。用於找不到題本、書籤等案例。 */
export async function gotoBooklet(page, base, subject, bookId) {
  await page.goto(base + '/daily/?subject=' + subject + '&book=' + encodeURIComponent(bookId));
  await waitBooklet(page);
}

/**
 * 從目錄點進一本：先開目錄，再點該科區塊內這本的動作連結。
 * 不給 bookId 時點該科第 1 個動作連結（目錄新的在上，通常是作答中那本）。
 */
export async function enterBooklet(page, base, subject, bookId) {
  await openCatalog(page, base, subject);
  const section = page.locator('#daily-directory-' + subject);
  const link = bookId ? section.locator(`[data-booklet-id="${bookId}"]`) : section.locator('[data-booklet-id]').first();
  await Promise.all([page.waitForURL(/[?&]book=/), link.click()]);
  await waitBooklet(page);
}

/** 在目錄按該科的開本按鈕，等導向新題本後回傳新題本 ID。按鈕不存在時直接失敗。 */
export async function openNewBooklet(page, base, subject) {
  await openCatalog(page, base, subject);
  await Promise.all([page.waitForURL(/[?&]book=/), page.locator(`[data-open-subject="${subject}"]`).click()]);
  await waitBooklet(page);
  return new URL(page.url()).searchParams.get('book');
}

/** 從帶 book 的畫面點「← 題本目錄」回目錄。 */
export async function backToCatalog(page) {
  await Promise.all([page.waitForURL((url) => !url.searchParams.has('book')), page.locator('#daily-back').click()]);
  await waitCatalog(page);
}
