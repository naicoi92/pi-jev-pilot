# 01 — Native child tool decision contract

Status: ready-for-agent  
Implementation: in-progress  
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

## Phạm vi khả thi sau quyết định user

Không sửa Pi SDK. Ưu tiên file-backed plugin có host binding xác thực với explicit agent tool list: tool JEV chọn có thể dùng trong child, hard ceiling/exclusion được giữ. Không thể chứng minh giới hạn cứng cho launch cụ thể → fail closed và diagnostic; không thay ceiling bằng active list. Tool bổ sung không thể cấp đúng policy → bỏ và cảnh báo parent/child. AC3/AC6 trên mọi exposure chưa được cam kết hoàn chỉnh; `codemode` chỉ cấp khi kiểm soát được quyền.

## Lát cắt triển khai

1. Contract và provenance: caller tools được hợp nhất tối thiểu ở launch plan; JEV selection giữ riêng, không thành required tool. Commit checkpoint chưa phải hoàn thành ticket.
2. Runtime: đối chiếu registry sau load, cảnh báo và xử lý optional tools qua transport hiện có. Hoàn thành ticket sau review và integration verification cả hai lát cắt.

## Comments

- Contract checkpoint đã merge fast-forward vào executor integration: `34fba452edd1f298bad431fd42a9258f0aef2a28`; review recovery PASS. Trên integration worktree: `npm run typecheck`, 2 public delegated async recovery tests và 15 descriptor tests đạt. Chưa xác minh detached revival E2E. Assertion package manifest lỗi cũng tái hiện trên base `944128f`; full suite chưa đạt. Runtime slice và integration verification toàn ticket còn pending.

- Blocker runtime: Pi 1.4.0 `dist/core/sdk.js:148–160` và `dist/core/agent-session.js:1138–1166,2928–2934` không tách registry ceiling khỏi active loadout. Snapshot một session không thể đặt lại registry allowlist qua public SDK. Thử nghiệm disposable với `noTools: "all"`, `tools: ["+read"]` và custom deferred `mcp__demo__extra` trả callable `["read", "mcp__demo__extra"]`: tool ngoài snapshot vẫn callable. Không gọi model; không coi thử nghiệm là E2E. Runtime candidate `3f93f30fcbd1122877561edc134ae93512f56aff` chưa merge; cần quyết định SDK boundary.

- Foreground explicit/file-backed checkpoint đã merge và review: `4e0b46b982636d66eba5ff7a091333ae1450a0a1`. Integration worktree: Pi 1.4.0 host tests 101/101 và typecheck đạt. Background, remote, implicit/MCP selection và `codemode.models` chưa hỗ trợ; ticket vẫn in-progress. Full suite có assertion manifest lỗi trên base.
- Review P2 còn theo dõi: admission trả `scope-denied` thay vì diagnostic cụ thể; warning first-prompt có thể bị tiêu thụ nếu prompt lỗi; cần bổ sung test baseline/selection `codemode` và `models`.

## Ranh giới

Repo executor `pi-subagents`, base `944128f754d1bd7ce17cfd5c325f0018bebe2a67`; không sửa installed release/cache. Chỉ thay contract cần thiết; không xây discovery subsystem. Đọc `AGENTS.md`, `VISION.md`, skill `tdd` và repo test commands. Không tự delegate. Merge integration branch tip vào branch trước khi báo, commit kết quả; báo SHA, tests và blockers. Dừng hỏi parent nếu contract không thể thực hiện mà mở rộng kiến trúc.
