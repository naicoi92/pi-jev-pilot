# Benchmark sơ bộ: JEV tool relevance

**Trạng thái:** Chưa đủ bằng chứng chọn ngưỡng production. Dataset 20 case, nhãn do assistant gán trước khi chạy, chưa được user review. Một role và một tool mỗi request; chưa kiểm tra nhiều tool trong cùng request.

## Phương pháp

Ngày đo: 2026-10-30. Lệnh tái chạy từ project root: `bun run scripts/tool-score-benchmark.ts` (script multi-tool sẽ được bổ sung cùng kết quả; lượt single-tool hiện tại chạy qua `bun -e` gọi `classify` và `workerToolQuestions` trực tiếp).

Dùng endpoint và model từ `loadJevConfig()`, model `jev-latest`, qua `classify()` production. Mỗi request chứa role, task, description tool, cùng các câu hỏi tier, effort, risky và `tool_0` từ `workerToolQuestions()`. Chạy ba lượt. Dataset: `tool-score-benchmark-data.json`. Không lưu credential hoặc response thô.

| Ngưỡng | Precision lượt 1/2/3 | Recall lượt 1/2/3 |
|---|---|---|
| 0.4 | 0.786 / 0.786 / 0.786 | 1.000 / 1.000 / 1.000 |
| 0.5 | 0.909 / 0.846 / 0.917 | 0.909 / 1.000 / 1.000 |
| 0.6 | 1.000 / 1.000 / 1.000 | 0.909 / 0.909 / 0.909 |
| 0.7 | 1.000 / 1.000 / 1.000 | 0.818 / 0.818 / 0.727 |
| 0.8 | 1.000 / 1.000 / 1.000 | 0.636 / 0.636 / 0.636 |

Không có score thiếu trong 60 request. Ở ngưỡng 0.6 không có false positive trong mẫu này, nhưng exclusion cao nhất là 0.58 và điểm sát ngưỡng: biên mỏng. Kết quả không chứng minh mức an toàn hoặc khả năng tổng quát hóa.

## Bước tiếp

Kiểm tra multi-tool request và tập role/task đa dạng hơn trước khi chọn ngưỡng mặc định. Tới khi có evidence tương ứng, không cấp tool JEV theo ngưỡng này.
