# L21101-A 共用語料

全部是教學合成資料。評論 R01–R12、交通訂位 T01–T12 各 12 句；各含 8 句中文與 4 句英文或中英混合句。

- text 保留原句，tokens 是人工指定的詞級輸入，pos 與 tokens 一對一；詞性是本例簡化中文標籤，不當作通用標準。
- negation_positions 是 tokens 的零起始索引；評論另有 sentiment，交通另有 intent、origin、destination、time；null 表示原句未提供。
- normalization 保存固定詞幹與（詞、詞性、原形）對照；字典未列時維持原詞，不聲稱執行任何套件。
- stopwords 分為保留否定詞與誤刪否定詞兩版；不是通用清單。
- split 固定 train 16、validation 4、test 4 筆，seed=42；此處不訓練分類器，不宣稱泛化能力。比較頁與後續向量組沿用同一索引，不重抽切分。
- BPE 微型訓練詞來自 R09、T09–T12 的詞形，為獨立的合併示範；只含 books×2、booking×1、booked×1，不拿它估計評測成效。每輪重新計數，固定同分規則。
- T12 子詞列預先允許「我、用、訂、位」作為基本字元；英文微型語料只學合併規則。中文字未被合併就逐字保留，這是教學設定，不代表未收錄字元的正式切分器也能保留原字。

參考數值：T12 不含空白共 9 字元、4 個詞、6 個指定子詞；BPE 三輪各以頻率 4 合併 b+o、bo+o、boo+k，訓練詞 token 總數 23→11。R02 安全停用詞移除 6→5，誤刪否定後 4；R01/R02 誤刪後相同。R03 有 4 個 bigram、3 個 trigram；不跨句、不補邊界。

七頁皆使用本檔：nlp 用 T01 與 R02；nlp-method-evolution 用 T01/T03；tokenization 用 T12 與 BPE；pos-tagging 用 T01/R02；stemming-lemmatization 用 R09–R11/T09–T11；stopword-removal 用 R01/R02/T01；n-gram 用 R03/T03。
