# 03 — Codemode theo tool và capability được cấp

Status: ready-for-agent  
Implementation: in-progress
Blocked by: 01, 02

## Mục tiêu

Cho native child sử dụng `codemode` theo tập tool thực tế; JEV đánh giá `codemode.models` riêng trong cùng request. Không cho phép capability bị chặn hoặc tool ngoài tập được cấp qua deferred/extension registry. Tool model-only giữ contract hiện tại.

## Acceptance

- Trace `../spec.md` AC3–AC6, AC8: kiểm thử public child launch và `codemode` với provider mock, phụ thuộc bị chặn, deferred tool, `models` bật/tắt và host không hỗ trợ.
- Không khẳng định allowlist là sandbox. Khi host hoặc provider không thể thực thi yêu cầu, dừng và báo blocker; không silently mở quyền.
- Integration test và report nêu rõ nếu không chạy Pi E2E thật. TDD từng lát cắt.

## Evidence và giới hạn

- Executor `7ada464e6e1a7915951dd32d8f4f5760f5e22d44`: bổ sung test public decision/admission cho baseline `codemode` và `models`, xác nhận selection báo unsupported và nonempty optional grant bị chặn trước receipt; caller `models`/`codemode` cũng bị đánh dấu unsupported. Typecheck và 137 Node tests đạt với Pi 1.4.0 host.
- Đây là kiểm thử fail-closed cho dynamic selection, **không chứng minh** baseline `codemode` giới hạn được registry, không triển khai chấm `codemode.models` riêng. Pi SDK public chưa tách registry ceiling khỏi active/default selection cho deferred/MCP; không mở rộng SDK theo quyết định user. Test này không chứng minh deferred provider và capability `models` bật/tắt, cũng không phải pilot → executor → child E2E.

## Ranh giới

Sửa executor và pilot theo contract đã có; phân tách writer theo repo/worktree, không sửa installed release/cache. Đọc skill `tdd`, spec và repo instructions. Không tự delegate. Merge integration tip vào branch trước khi báo, commit kết quả; báo SHA, test và blockers. Không tạo permission framework mới nếu host primitive đủ.
