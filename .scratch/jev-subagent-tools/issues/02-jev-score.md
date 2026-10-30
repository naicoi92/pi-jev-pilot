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

## Ranh giới

Repo pilot; dùng executor contract đã tích hợp từ ticket 01. Không chỉnh installed release, cache hoặc ngoài scope. Đọc skill `tdd`, spec và project instructions; không tự delegate. Merge integration tip trước khi báo; commit kết quả, báo SHA, tests và benchmark. Nếu không có điều kiện benchmark thực tế, dừng và báo blocker, không tự đặt ngưỡng.
