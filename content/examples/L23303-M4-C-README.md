# M4-C：從教材資料重訓與回讀新實驗

本例使用 `L23303-M4-C-label-efficiency.json` 已保存的 3000 筆合成文字、標籤與索引，不下載外部資料。它重訓詞級邏輯迴歸、字元線性 SVM、詞級多項式朴素貝氏，在 200／1000／2000 筆與五個種子下各試三個參數，共 135 次 fit、45 個選定模型。只以固定 400 筆驗證資料選參數，最後回報固定 600 筆測試結果。

`L23303-M4-C-run-lineage.json` 保存的是**歷史作者 run**。其中的 tmp 腳本、模型與 SQLite store 未隨教材交付，讀者不能查回舊 run `1705be744a7f4e6f88b0a95bac79a87f`。本程式從教材取回同一份資料，建立讀者自己的新 run，再用 API 回讀與下載核對；不改寫舊清單，也不冒充舊模型或舊 run。

原清單的 commit `4da58a5` 只是歷史基線，不包含本 README 或歷史暫存腳本。本次執行另記目前 checkout 的 HEAD、輸入教材與**實際執行的 Python 檔案**雜湊；HEAD 不能單獨代表未提交內容。

## 執行方式

使用專案已備妥的 `tools/python` 環境，沒有新相依。歷史版本是 Python 3.12.13、NumPy 2.5.4、scikit-learn 1.9.1；環境鎖檔見 `tools/python/uv.lock`。完整複製下方程式成專案內的 `tmp/m4-c-reproduce.py`，在 repo 根目錄執行：

```powershell
$env:UV_NO_SYNC = "1"
$env:MLFLOW_DISABLE_AGENT_HINT = "1"
uv run --project tools/python python tmp/m4-c-reproduce.py --root . --out tmp/m4-c-reader-01
```

若 Orca 工作樹使用協調者提供的既有共用環境，另設 `UV_PROJECT_ENVIRONMENT` 指向該 `.venv`。其他讀者使用自己 checkout 的既有環境，不需要作者的 E: 路徑或 ignored tmp。輸出目錄須尚未存在，重跑請換新名稱；程式只允許寫入指定 repo 的新 `tmp/` 子目錄，不覆寫教材或歷史證據。不執行 DVC、不連付費服務，也不啟動伺服器。

## 完整重現程式

```python
"""由已保存教材取回資料、重訓、記錄與回讀；所有產物只寫新的 tmp 子目錄。"""
import argparse
import hashlib
import json
import os
import pickle
import platform
import subprocess
import time
from collections import Counter
from pathlib import Path

# 在匯入數值函式庫前固定執行緒；不另安裝資源量測套件。
for name in ["OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS",
             "BLIS_NUM_THREADS", "VECLIB_MAXIMUM_THREADS", "NUMEXPR_NUM_THREADS"]:
    os.environ[name] = "1"
os.environ["MLFLOW_DISABLE_AGENT_HINT"] = "1"
os.environ["MLFLOW_ENABLE_SYSTEM_METRICS_LOGGING"] = "false"

import numpy as np
import sklearn
import mlflow
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, recall_score
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline
from sklearn.svm import LinearSVC


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":")).encode("utf-8")


def sha(value):
    return hashlib.sha256(value).hexdigest()


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")


def f1(truth, prediction):
    return float(f1_score(truth, prediction, labels=[0, 1],
                          average="macro", zero_division=0))


def pipeline(route, parameter, seed):
    if route == "char-svm":
        vector = TfidfVectorizer(analyzer="char", ngram_range=(2, 4))
        classifier = LinearSVC(C=parameter, dual=False, max_iter=2000,
                               random_state=seed)
    else:
        vector = TfidfVectorizer(tokenizer=str.split, token_pattern=None,
                                 ngram_range=(1, 2))
        classifier = (MultinomialNB(alpha=parameter) if route == "word-nb"
                      else LogisticRegression(C=parameter, solver="liblinear",
                                              max_iter=1000, random_state=seed))
    return make_pipeline(vector, classifier)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    out = (root / args.out).resolve()
    tmp = (root / "tmp").resolve()
    if not out.is_relative_to(tmp) or out == tmp or out.exists():
        raise ValueError("--out 須為 repo/tmp 內尚未存在的新子目錄")
    source = root / "content/examples/L23303-M4-C-label-efficiency.json"
    history_path = root / "content/examples/L23303-M4-C-run-lineage.json"
    source_bytes = source.read_bytes()
    history_bytes = history_path.read_bytes()
    data = json.loads(source_bytes)
    history = json.loads(history_bytes)
    records, split = data["records"], data["base_split"]
    payload = canonical({"records": records, "split": split})
    fingerprint = {"sha256": sha(payload),
                   "md5": hashlib.md5(payload).hexdigest(), "size": len(payload)}
    assert fingerprint == {
        "sha256": "56208dde31d6123e81592a099da588425b1b750ff89bd025ac0dc298b124edbd",
        "md5": "cd55040621b4ccbf46df1c0544427c70", "size": 489723}
    assert fingerprint["sha256"] == data["metadata"]["dataset_sha256"]
    assert [len(split[k]) for k in ["train", "val", "test"]] == [2000, 400, 600]
    pools = [set(split[k]) for k in ["train", "val", "test"]]
    assert len(records) == 3000 and set.union(*pools) == set(range(3000))
    assert all(pools[i].isdisjoint(pools[j]) for i in range(3) for j in range(i))
    assert len({r["text"] for r in records}) == len(records)
    assert all(r["id"] == i and r["label"] in [0, 1] for i, r in enumerate(records))
    for part, count in [("train", 500), ("val", 100), ("test", 150)]:
        assert all(records[i]["split"] == part for i in split[part])
        strata = Counter((records[i]["domain"], records[i]["label"]) for i in split[part])
        assert len(strata) == 4 and set(strata.values()) == {count}
    seeds = data["metadata"]["sampling_seeds"]
    assert seeds == [11, 22, 33, 44, 55]
    assert set(data["subsets"]) == {str(s) for s in seeds}
    for seed in seeds:
        subsets = data["subsets"][str(seed)]
        assert set(subsets) == {"200", "1000", "2000"}
        assert set(subsets["200"]) < set(subsets["1000"]) < set(subsets["2000"]) == pools[0]
        for n in [200, 1000, 2000]:
            ids = subsets[str(n)]
            assert len(ids) == len(set(ids)) == n
            strata = Counter((records[i]["domain"], records[i]["label"]) for i in ids)
            assert len(strata) == 4 and set(strata.values()) == {n // 4}
    unions = {str(n): len(set().union(*(set(data["subsets"][str(s)][str(n)])
               for s in seeds))) for n in [200, 1000, 2000]}
    assert unions == {"200": 831, "1000": 1935, "2000": 2000}
    assert sha(canonical(split)) == history["split_sha256"]
    assert sha(canonical(split["test"])) == data["metadata"]["test_ids_sha256"]
    grid = data["metadata"]["budget"]["grid"]
    assert grid == [0.1, 1, 10]
    assert data["metadata"]["budget"]["fits_per_route_size_seed"] == 3
    routes = ["word-lr", "char-svm", "word-nb"]
    old_runs = {(r["route"], r["n"], r["seed"]): r for r in data["runs"]}
    assert len(old_runs) == len(data["runs"]) == 45
    out.mkdir(parents=True, exist_ok=False)
    (out / "dataset-canonical.json").write_bytes(payload)
    save(out / "split.json", split)
    script_bytes = Path(__file__).resolve().read_bytes()
    (out / "executed-script.py").write_bytes(script_bytes)
    texts = [r["text"] for r in records]
    labels = np.array([r["label"] for r in records])
    val_ids, test_ids = split["val"], split["test"]
    val_text = [texts[i] for i in val_ids]
    test_text = [texts[i] for i in test_ids]
    runs, fit_count, chosen, chosen_model = [], 0, None, None
    for n in [200, 1000, 2000]:
        for seed in seeds:
            ids = data["subsets"][str(seed)][str(n)]
            train_text = [texts[i] for i in ids]
            for route in routes:
                best, trials = None, []
                start = time.perf_counter()
                for parameter in grid:
                    model = pipeline(route, parameter, seed).fit(train_text, labels[ids])
                    fit_count += 1
                    prediction = model.predict(val_text)
                    score = f1(labels[val_ids], prediction)
                    trials.append({"parameter": parameter, "val_macro_f1": score})
                    # 嚴格大於才取代，因此同分保留格點順序較前者。
                    if best is None or score > best[0]:
                        best = (score, parameter, model, prediction)
                seconds = time.perf_counter() - start
                val_score, parameter, model, val_prediction = best
                prediction = model.predict(test_text)
                row = {"route": route, "n": n, "seed": seed, "trials": trials,
                       "train_ids_sha256": sha(canonical(ids)),
                       "selected_parameter": parameter, "val_macro_f1": val_score,
                       "test_macro_f1": f1(labels[test_ids], prediction),
                       "test_accuracy": float(accuracy_score(labels[test_ids], prediction)),
                       "test_positive_recall": float(recall_score(labels[test_ids], prediction)),
                       "val_predictions": val_prediction.tolist(),
                       "test_predictions": prediction.tolist(),
                       "search_seconds_this_execution": seconds}
                old = old_runs[(route, n, seed)]
                for field in ["selected_parameter", "train_ids_sha256",
                              "val_predictions", "test_predictions"]:
                    assert row[field] == old[field], (route, n, seed, field)
                for field in ["val_macro_f1", "test_macro_f1", "test_accuracy", "test_positive_recall"]:
                    assert abs(row[field] - old[field]) < 1e-12, (route, n, seed, field)
                for actual, expected in zip(trials, old["trials"], strict=True):
                    assert actual["parameter"] == expected["parameter"]
                    assert abs(actual["val_macro_f1"] - expected["val_macro_f1"]) < 1e-12
                runs.append(row)
                if (route, n, seed) == ("word-lr", 1000, 11):
                    chosen, chosen_model = row, model
    assert fit_count == 135 and len(runs) == 45
    summary = []
    for n in [200, 1000, 2000]:
        for route in routes:
            values = [r["test_macro_f1"] for r in runs if (r["route"], r["n"]) == (route, n)]
            row = {"n": n, "route": route, "test_f1_mean": float(np.mean(values)),
                   "test_f1_std_ddof0": float(np.std(values, ddof=0))}
            old = next(r for r in data["summary"] if (r["route"], r["n"]) == (route, n))
            assert all(abs(row[k] - old[k]) < 1e-12 for k in ["test_f1_mean", "test_f1_std_ddof0"])
            summary.append(row)
            print(n, route, f'{row["test_f1_mean"]:.4f}±{row["test_f1_std_ddof0"]:.4f}')
    model_path = out / "word-lr-1000-11.pkl"
    model_bytes = pickle.dumps(chosen_model, protocol=5)
    model_path.write_bytes(model_bytes)
    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        commit = None
    manifest = {"kind": "讀者重訓的新 run；不是歷史作者 run",
                "git_commit_this_checkout": commit, "script_sha256": sha(script_bytes),
                "input_json_sha256": sha(source_bytes), "dataset": fingerprint,
                "split_sha256": sha(canonical(split)),
                "train_ids_sha256": chosen["train_ids_sha256"],
                "route": "word-lr", "n": 1000, "seed": 11,
                "C": chosen["selected_parameter"], "model_sha256": sha(model_bytes),
                "historical_run_id": history["mlflow_run_id"],
                "historical_model_sha256": history["model_sha256"],
                "model_bytes_equal_history": sha(model_bytes) == history["model_sha256"],
                "predictions_equal_history": chosen["test_predictions"] == old_runs[("word-lr", 1000, 11)]["test_predictions"],
                "environment": {"python": platform.python_version(), "numpy": np.__version__,
                                "sklearn": sklearn.__version__, "mlflow": mlflow.__version__,
                                "os": platform.platform(), "threads_requested": 1},
                "resource_note": "本次僅重測搜尋秒數；RSS及p95仍為原JSON歷史值，未重測、不替換",
                "dvc_status": "未執行DVC；資料由教材JSON重建"}
    save(out / "run-input.json", manifest)
    uri = "sqlite:///" + (out / "mlflow.db").as_posix()
    mlflow.set_tracking_uri(uri)
    experiment_id = mlflow.create_experiment("m4-c-reader", artifact_location=(out / "artifacts").as_uri())
    params = {"route": "word-lr", "n": "1000", "seed": "11",
              "C": str(chosen["selected_parameter"]), "f1_average": "macro"}
    tags = {"dataset_sha256": fingerprint["sha256"], "dataset_md5": fingerprint["md5"],
            "dataset_size": str(fingerprint["size"]), "split_sha256": manifest["split_sha256"],
            "train_ids_sha256": manifest["train_ids_sha256"], "script_sha256": manifest["script_sha256"],
            "input_json_sha256": manifest["input_json_sha256"], "model_sha256": manifest["model_sha256"],
            "git_commit_this_checkout": commit or "unavailable", "dvc_executed": "false"}
    with mlflow.start_run(experiment_id=experiment_id, run_name="reader-word-lr-1000-11") as run:
        run_id = run.info.run_id
        mlflow.log_params(params)
        mlflow.set_tags(tags)
        mlflow.log_metric("val_macro_f1", chosen["val_macro_f1"])
        mlflow.log_metric("test_macro_f1", chosen["test_macro_f1"])
        for name in ["dataset-canonical.json", "split.json", "executed-script.py",
                     "run-input.json", model_path.name]:
            mlflow.log_artifact(str(out / name))
    # context 已結束，以下重新查已關閉的 run，並核對下載內容。
    client = mlflow.MlflowClient(tracking_uri=uri)
    back = client.get_run(run_id)
    assert back.info.status == "FINISHED" and run_id != history["mlflow_run_id"]
    assert all(back.data.params[k] == v for k, v in params.items())
    assert all(back.data.tags[k] == v for k, v in tags.items())
    assert back.data.metrics["test_macro_f1"] == chosen["test_macro_f1"]
    assert back.data.metrics["val_macro_f1"] == chosen["val_macro_f1"]
    download = out / "download"
    download.mkdir()
    hashes = {}
    for name in ["dataset-canonical.json", "split.json", "executed-script.py",
                 "run-input.json", model_path.name]:
        fetched = Path(client.download_artifacts(run_id, name, dst_path=str(download)))
        assert sha(fetched.read_bytes()) == sha((out / name).read_bytes())
        hashes[name] = sha(fetched.read_bytes())
    loaded = pickle.loads((download / model_path.name).read_bytes())
    assert loaded.predict(test_text).tolist() == chosen["test_predictions"]
    assert source.read_bytes() == source_bytes and history_path.read_bytes() == history_bytes
    save(out / "reproduction.json", {"fit_count": fit_count, "model_count": len(runs),
         "dataset": fingerprint, "union_counts": unions, "runs": runs, "summary": summary,
         "lineage": manifest, "new_run_id": run_id, "readback_status": back.info.status,
         "readback_params": back.data.params, "readback_metrics": back.data.metrics,
         "downloaded_sha256": hashes})
    print("fit=135 models=45；27000筆測試、18000筆驗證預測與教材一致")
    print("canonical", fingerprint)
    print("new_run_id", run_id, "FINISHED；參數、指標及5個附件回讀核對通過")
    print("model_bytes_equal_history", manifest["model_bytes_equal_history"])
    print("完整證據：", out / "reproduction.json")


if __name__ == "__main__":
    main()
```

## 如何讀輸出

`reproduction.json` 保存本次 135 個驗證格點分數、45 組驗證／測試預測及九列平均／ddof=0 波動。程式真的重新 fit，再比對教材結果；讀取原 summary 只作事後核對，不作新模型答案。不同套件版本若改變預測或選參數，assert 會指出差異，請先核對環境版本；不能把不符的結果寫成已重現。

新的 `mlflow.db`、附件與下載檔都在此次輸出目錄。程式會回讀 FINISHED 狀態、參數、兩個指標及全部五個附件 SHA-256，並載入**自己剛產生**的模型比對預測。run ID 必定另產生；模型 pickle 位元組可能受序列化細節影響，實際雜湊與是否等於歷史值都會記錄。預測、指標一致不能代稱模型位元組一致。

搜尋秒數是本次量測，歷史教材的搜尋秒數、RSS、p95 延遲保留原值；此程式沒有重測 RSS 或延遲。環境與負載不同，不要求這些資源值逐位相同。單輪 1000 筆限制與五輪聯集 1935 筆也要分清；若整個專案只能取得 1000 筆標註，本設計不符合該總量上限。

參考：[scikit-learn 文字分類與資源比較](https://scikit-learn.org/stable/auto_examples/text/plot_document_classification_20newsgroups.html)、[Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html)、[F1 API](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html)、[MLflow Python API](https://mlflow.org/docs/latest/api_reference/python_api/mlflow.html)、[MLflow Client API](https://mlflow.org/docs/latest/api_reference/python_api/mlflow.client.html)。
