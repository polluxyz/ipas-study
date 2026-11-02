/** 將已載入的單元與目前路線轉成 Starlight 側欄；保留原有階段與概念順序。 */
interface SidebarRoute {
  code: string;
  subject: number;
  title: string;
  stages?: readonly { title: string; concepts: readonly { id: string }[] }[];
}

export function buildStudySidebar(routes: readonly SidebarRoute[], currentRoute: SidebarRoute | undefined, conceptTitles: ReadonlyMap<string, string>) {
  const chapterNumbers = ['一', '二', '三', '四', '五', '六'];
  return [
    { label: '學習總覽', link: '/' }, { label: '概念目錄', link: '/catalog/' },
    { label: '概念地圖', link: '/map/' }, { label: '我的錯題本', link: '/wrong-book/' },
    ...(currentRoute?.stages?.length ? [{ label: '本次學習路線', items: currentRoute.stages.map((stage, index) => ({
      label: `${chapterNumbers[index] ?? index + 1}、${stage.title}`, collapsed: true,
      items: stage.concepts.flatMap(({ id }) => {
        const title = conceptTitles.get(id);
        return title === undefined ? [] : [{ label: title, link: `/concepts/${id}/` }];
      }),
    })) }] : []),
    ...[1, 3].map((subject) => ({
      label: `科目 ${subject}`, collapsed: currentRoute?.subject !== subject,
      items: routes.filter((route) => route.subject === subject).map((route) => ({
        label: `${route.code} ${route.title}`, link: `/codes/${route.code}/`,
      })),
    })),
  ];
}
