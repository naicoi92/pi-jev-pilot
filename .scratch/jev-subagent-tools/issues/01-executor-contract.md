# 01 — Native child tool decision contract

Status: ready-for-agent  
Implementation: pending  
Blocked by: none

## Mục tiêu

Mở rộng public worker decision và native child launch tại executor để nhận metadata tool có sẵn và lựa chọn JEV; hợp nhất `agent.tools` + caller tools + lựa chọn JEV, giữ ceiling, exclusions và tool contract bắt buộc. Không khởi tạo provider chỉ để discovery. Phân biệt tool theo nguồn; cảnh báo thiếu provider/tool cho parent và child, không chặn tool tùy chọn bị thiếu. Xử lý foreground/background và lifecycle/retry đúng contract hiện tại.

## Acceptance

- Trace spec `../spec.md` AC1–AC5; metadata và lựa chọn đi qua immutable snapshot, validation, receipt và launch nhất quán.
- Không biến agent allowlist thành ceiling ngăn lựa chọn bổ sung; hard ceiling/exclusion vẫn được thực thi.
- Tool contract bắt buộc bị chặn báo lỗi; tập rỗng hợp lệ; thiếu metadata/tool cảnh báo.
- Integration tests qua public worker decision/child launch seam; TDD từng lát cắt.

## Ranh giới

Repo executor `pi-subagents`, base `944128f754d1bd7ce17cfd5c325f0018bebe2a67`; không sửa installed release/cache. Chỉ thay contract cần thiết; không xây discovery subsystem. Đọc `AGENTS.md`, `VISION.md`, skill `tdd` và repo test commands. Không tự delegate. Merge integration branch tip vào branch trước khi báo, commit kết quả; báo SHA, tests và blockers. Dừng hỏi parent nếu contract không thể thực hiện mà mở rộng kiến trúc.
