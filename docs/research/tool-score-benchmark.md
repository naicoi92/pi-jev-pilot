# Benchmark sơ bộ: JEV tool relevance

> **Đã thay thế (2026-10-31):** worker tool selection chuyển sang *default-allow*. Câu hỏi classifier là "nguy hiểm / rõ ràng không phù hợp"; chỉ tool có điểm >= `workerToolRejectThreshold` (mặc định `0.7`) bị loại, tool vượt cap 32 câu hỏi vẫn được cho phép. Ngưỡng `0.65` dưới đây là của mô hình *chọn tool phù hợp* cũ. Probe 2 task thật cho thấy mô hình cũ loại cả `codegraph_*`, `fetch_content`, `todo` (điểm 0.4–0.6); `workerToolThreshold` cũ bị bỏ qua kèm cảnh báo.


**Kết quả:** Default đề xuất `0.65`, cấu hình được. Dataset nhỏ, nhãn do assistant gán trước khi chạy và chưa được user review; kết quả không phải bảo đảm an toàn.

## Phương pháp

Ngày đo: 2026-10-30. Chạy bằng `bun -e` từ project root, gọi `classify`, `systemOneConfig`, `captureEffortAssessment` và `workerToolQuestions` với dataset được lưu cạnh tài liệu. Chưa có script tái chạy đóng gói.

Dùng endpoint và model từ `loadJevConfig()`, model `jev-latest`, qua `classify()` production. Mỗi request chứa role, task, description tool, cùng các câu hỏi tier, effort, risky và `tool_0` từ `workerToolQuestions()`. Chạy ba lượt. Dataset: `tool-score-benchmark-data.json`. Không lưu credential hoặc response thô.

| Ngưỡng | Precision lượt 1/2/3 | Recall lượt 1/2/3 |
|---|---|---|
| 0.4 | 0.786 / 0.786 / 0.786 | 1.000 / 1.000 / 1.000 |
| 0.5 | 0.909 / 0.846 / 0.917 | 0.909 / 1.000 / 1.000 |
| 0.6 | 1.000 / 1.000 / 1.000 | 0.909 / 0.909 / 0.909 |
| 0.7 | 1.000 / 1.000 / 1.000 | 0.818 / 0.818 / 0.727 |
| 0.8 | 1.000 / 1.000 / 1.000 | 0.636 / 0.636 / 0.636 |

Không có score thiếu trong 60 request. Ở ngưỡng 0.6 không có false positive trong mẫu này, nhưng exclusion cao nhất là 0.58 và điểm sát ngưỡng: biên mỏng. Kết quả không chứng minh mức an toàn hoặc khả năng tổng quát hóa.

## Multi-tool và chọn ngưỡng

Dataset `tool-score-multitool-data.json` gồm worker, reviewer và scout; ba lượt theo thứ tự gốc và một lượt đảo thứ tự. Scores theo nhóm, tool, vị trí và outcome lưu tại `tool-score-multitool-results.json`. Không có score thiếu.

| Ngưỡng | Precision lượt 1/2/3/đảo | Recall lượt 1/2/3/đảo |
|---|---|---|
| 0.60 | 1 / 1 / 1 / 1 | 0.929 / 0.929 / 0.929 / 1.000 |
| 0.65 | 1 / 1 / 1 / 1 | 0.929 / 0.929 / 0.929 / 0.929 |
| 0.70 | 1 / 1 / 1 / 1 | 0.857 / 0.929 / 0.857 / 0.857 |
| 0.75 | 1 / 1 / 1 / 1 | 0.857 / 0.786 / 0.857 / 0.786 |
| 0.80 | 1 / 1 / 1 / 1 | 0.714 / 0.714 / 0.643 / 0.643 |

Đảo thứ tự làm score thay đổi tối đa 0.02 so với lượt đầu. Không so sánh interference với single-tool vì task và role giữa hai bộ khác nhau.

Quy tắc định trước: chọn ngưỡng nhỏ nhất trong `0.60/0.65/0.70/0.75/0.80` cao hơn max exclude ít nhất 0.05, với recall tối thiểu 0.5 mỗi lượt. Max exclude chung là 0.58 ở single-tool; `0.65` thỏa quy tắc. Case review/edit có role chung chung là trường hợp mơ hồ, giữ nguyên nhãn. Mẫu nhỏ và nhãn chưa được user review là giới hạn chính.
