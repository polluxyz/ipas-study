# L21101-E 共用資料

本資料完全合成，涵蓋電商客服與醫療行政／法律兩組領域。所有七頁引用同一份 L21101-E-service-documents.json；人工標籤、摘要及翻譯參考不冒充模型輸出。

- customer：16 句；id、text、language、intent、sentiment、dialogue_state、handoff、summary_reference、entities、triples、split。intent 四類各 4 句；中立 12、負面 4；handoff 4 句。這批資料沒有正面整句，不能拿來估計三極性模型效果。
- split：固定訓練 12 句，測試 E04、E08、E12、E16 各類一筆；seed=42。分類比較必須沿用索引，正式應用另備驗證集。
- documents：醫療行政 M01–M06、法律 L01–L06 共 12 段；summary_points 為人工摘要核對點，glossary 是術語對照，review/handoff 表示待覆核，不是正負標籤。
- entities：id、原文 text、start、end、type；採零起算、左含右不含的 Python Unicode 字元索引，保留標點。所有資料皆為 BMP 字元，前端若加入 emoji 應另處理 UTF-16 座標。
- triples：subject、predicate、object、evidence_id；兩端指向同文件 entity id。空陣列表示沒有本任務已確認關係，並非不存在任何現實關係。
- overlap_candidates：M06 的兩個相交候選；主標註採完整組織，細粒度需另訂契約。rejected_candidates：L02 否定、L05 未確定，均不當已成立關係。
- dialogues：訂票三輪與自由問答兩輪，示範欄位更新及前文追蹤；不是可執行服務。
- translations：M02、L02 的人工英譯、故意錯譯及核對點，不是翻譯模型效能。

關鍵值：M01「林安」[0,2)、「青禾醫院」[3,7)；M06 完整組織 [0,7)、內層組織 [0,4)。L01 有 3 個實體、2 個已確認三元組；L02 與 L05 的已確認三元組均為 0。

使用頁面：文字分類讀訓練／測試；情感分析讀 E13–E15；對話系統讀 dialogues 與 handoff；生成摘要讀 E01、M02、L05；翻譯讀 translations；NER 讀 M01、M06、L01；關係抽取讀 M01、L01、L02、M05。
