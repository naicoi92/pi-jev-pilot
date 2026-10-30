# 02 — JEV chấm tool cùng worker decision

Status: ready-for-agent  
Implementation: pending  
Blocked by: executor foreground checkpoint `4e0b46b982636d66eba5ff7a091333ae1450a0a1` (đã merge); phần còn lại của ticket 01 vẫn pending.

## Mục tiêu

Trong pilot, gửi metadata tool, task và role qua cùng request JEV chọn tier/effort; chấm độ phù hợp và bổ sung tool đạt ngưỡng qua executor contract. Luôn đánh giá native launch kể cả caller override; không thêm request riêng. Tính năng bật mặc định, có thể tắt riêng. Chỉ đề xuất grant ở foreground explicit/file-backed path được hỗ trợ; background và path chưa hỗ trợ giữ baseline và cảnh báo, không biến launch thành scope-denied vì grant JEV.

## Acceptance

- Trace `../spec.md` AC1, AC2, AC4, AC7, AC8; khi classifier timeout/lỗi, owner adapter trả decision baseline hợp lệ trong authority deadline; không bypass generic authority fail-closed. Kết quả một phần giữ các phần hợp lệ, thiếu score không tự bổ sung tool; cảnh báo theo spec.
- Benchmark role/task/tool đại diện, ghi evidence và chọn ngưỡng theo kết quả, không giả định confidence là xác suất. Không gửi dữ liệu không cần thiết.
- Integration tests qua worker decision request/response, TDD từng lát cắt; chạy `bun run typecheck`, `bun run lint` và test liên quan.

## Test matrix dự kiến

| AC | Test | Nguồn expected |
|---|---|---|
| AC1 | Score vượt ngưỡng chọn đúng identity host | Identity literal trong fixture |
| AC2 | Inventory thiếu hoặc invalid được cảnh báo | Spec §Hành vi 6 |
| AC4 | Timeout/service error giữ baseline | Spec §Lỗi và fallback |
| AC4 | Score lỗi chỉ loại tool tương ứng | Spec §Lỗi và fallback |
| AC4 | Model/effort lỗi giữ baseline, score hợp lệ vẫn áp dụng | Spec §Lỗi và fallback |
| AC7 | Một POST chứa effort/tier và tool questions | Spec §Hành vi 2 |
| AC7 | Tắt chọn tool không đổi request model/effort | Spec §Hành vi 7 |
| AC7 | Path unsupported không cấp tool, có cảnh báo | Phạm vi ticket 02 |

## Comments

- Lane scoring bị chặn do upstream: `Incomplete Claude Code upstream response (status 200, capture incomplete, relay failure Error, native retries denied 1)`; resume cùng protocol thất bại lần nữa. Run `29652fa6-685d-4a01-b6db-b9e9c341c45f`, retry `fc12bab4-0b4a-4c49-8e6d-baee24bc3b51`. Worktree `/tmp/jev-subagent-tools-scoring` sạch tại `f1ae15cdde488e4f0f17f91ed4b33cb34c85b97c`; chưa có implementation hoặc benchmark.
- User cho phép đổi model worker. Run `51211339-e5ed-4cf0-8e15-c180f546d824` yêu cầu `9router/gpt-6.1-terra` nhưng status ghi thực tế `claude-code/claude-sonnet-5-5`; đã stop, worktree sạch. Không giả định model override thắng JEV.
- User yêu cầu retry model hiện tại; run `78575fb6-2203-40e6-9074-8c0c70584032` lại thất bại: `Incomplete Claude Code upstream response (status 200, capture incomplete, relay failure Error, native retries denied 1)`. Worker chạy `find /` ngoài phạm vi; parent dừng PID `70048` và gửi ràng buộc không quét máy. Kiểm tra sau đó không còn tiến trình `find /`; scoring worktree sạch tại `f1ae15cdde488e4f0f17f91ed4b33cb34c85b97c`.

## Ranh giới

Repo pilot; dùng executor contract đã tích hợp từ ticket 01. Không chỉnh installed release, cache hoặc ngoài scope. Đọc skill `tdd`, spec và project instructions; không tự delegate. Merge integration tip trước khi báo; commit kết quả, báo SHA, tests và benchmark. Nếu không có điều kiện benchmark thực tế, dừng và báo blocker, không tự đặt ngưỡng.
