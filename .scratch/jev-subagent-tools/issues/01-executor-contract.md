# 01 — Native child tool decision contract

Status: ready-for-agent  
Implementation: pending  
Blocked by: none

## Mục tiêu

Mở rộng public worker decision và native child launch tại executor để nhận metadata tool có sẵn và lựa chọn JEV; hợp nhất `agent.tools` + caller tools + lựa chọn JEV, giữ ceiling, exclusions và tool contract bắt buộc. Không khởi tạo provider chỉ để discovery. Phân biệt tool theo nguồn; cảnh báo thiếu provider/tool cho parent và child, không chặn tool tùy chọn bị thiếu. Xử lý foreground/background và lifecycle/retry đúng contract hiện tại.

## Acceptance

- Trace spec `../spec.md` AC1–AC5; metadata và lựa chọn đi qua immutable snapshot, validation, receipt và launch nhất quán.
- Thêm `tools?: string[]` cho native per-launch delegation nếu cần: nghĩa bổ sung vào agent tools, không replace; bỏ trống hoặc `[]` không xóa mặc định. Propagate qua các native launch paths.
- Không biến agent allowlist thành ceiling ngăn lựa chọn bổ sung; hard ceiling/exclusion vẫn được thực thi.
- Tool contract bắt buộc bị chặn hoặc thiếu báo lỗi; tập rỗng hợp lệ. Với dynamic selection bật, đối chiếu registry sau load, bỏ tool thường thiếu khỏi tập thực tế và cảnh báo parent/child qua transport hiện có; khi tắt giữ strict contract cũ.
- Giữ generic authority fail-closed khi owner reject, mất owner, cancellation hoặc hết deadline. Fallback classifier do owner adapter ở ticket 02 trả thành decision hợp lệ trong authority deadline; không bypass authority.
- Chỉ dùng metadata và provider binding host thực có; không suy đoán provider/path. Mapping thiếu hoặc mơ hồ thì bỏ tool bổ sung và cảnh báo; không tạo discovery subsystem.
- Integration tests qua public worker decision/child launch seam; TDD từng lát cắt.

## Lát cắt triển khai

1. Contract và provenance: caller tools được hợp nhất tối thiểu ở launch plan; JEV selection giữ riêng, không thành required tool. Commit checkpoint chưa phải hoàn thành ticket.
2. Runtime: đối chiếu registry sau load, cảnh báo và xử lý optional tools qua transport hiện có. Hoàn thành ticket sau review và integration verification cả hai lát cắt.

## Ranh giới

Repo executor `pi-subagents`, base `944128f754d1bd7ce17cfd5c325f0018bebe2a67`; không sửa installed release/cache. Chỉ thay contract cần thiết; không xây discovery subsystem. Đọc `AGENTS.md`, `VISION.md`, skill `tdd` và repo test commands. Không tự delegate. Merge integration branch tip vào branch trước khi báo, commit kết quả; báo SHA, tests và blockers. Dừng hỏi parent nếu contract không thể thực hiện mà mở rộng kiến trúc.
