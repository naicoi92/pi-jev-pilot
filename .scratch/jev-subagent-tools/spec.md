# Spec: JEV chọn tool cho subagent

**Trạng thái:** Bản nháp chờ duyệt; chưa triển khai.  
**Phạm vi:** Native Pi subagent. External CLI agent giữ contract riêng.

**Điều chỉnh phạm vi:** Không mở rộng Pi SDK. Triển khai lựa chọn tool trên các đường launch có thể thực thi đúng hard ceiling; đường không bảo đảm được quyền phải fail closed và báo rõ. Không tuyên bố AC3/AC6 hoàn chỉnh trên mọi SDK exposure. Tool/provider không thể cấp đúng policy được bỏ khỏi phần lựa chọn bổ sung và cảnh báo. Không dùng discovery hai session hoặc sentinel nội bộ.

## Mục tiêu

Plugin mới không cần sửa danh sách tool trong từng agent. Khi launch subagent, JEV đánh giá tool phù hợp với task và role, rồi bổ sung vào tool mặc định của agent và tool caller yêu cầu. Subagent cũng có thể sử dụng `codemode` với các tool được cấp.

## Hành vi

1. Với mỗi launch, JEV nhận task, mô tả role và tên/mô tả các tool có metadata sẵn. Không chủ động gửi credentials, output hoặc lịch sử không cần thiết. Task và mô tả vẫn có thể chứa dữ liệu nhạy cảm; không coi đây là cơ chế xóa secret.
2. Trong cùng request quyết định model tier và effort, JEV chấm **độ phù hợp** của từng tool với task và role. JEV tiếp tục được gọi kể cả khi caller chỉ định model/effort; quyết định JEV có thể ghi đè các giá trị đó.
3. Tập tool dự kiến là hợp của `agent.tools`, tool caller chỉ định và tool có score đạt ngưỡng; loại trùng theo định danh đầy đủ. `agent.tools` không giới hạn các tool JEV có thể bổ sung. `excludeTools` và các giới hạn cứng độc lập vẫn có hiệu lực.
4. Tool bắt buộc bởi contract của run được tự cấp nếu được phép; nếu giới hạn cứng chặn tool bắt buộc, không launch và báo xung đột. Mô tả role là tín hiệu để chấm điểm, không phải giới hạn cứng: tool ghi có thể được chọn cho role mô tả chỉ đọc.
5. Tool được chọn không khả dụng: tiếp tục với phần khả dụng và cảnh báo parent lẫn child. Phụ thuộc bị chặn thì không cấp tool phụ thuộc và cảnh báo. Tập tool rỗng hợp lệ khi không có tool contract bắt buộc.
6. Chỉ xét metadata đã có, không khởi tạo provider chỉ để discovery. Plugin mới được xét khi metadata xuất hiện; nếu biết danh sách thiếu thì cảnh báo. Phân biệt tool trùng tên theo nguồn; không ánh xạ rõ thì bỏ qua và cảnh báo.
7. Chọn tool một lần mỗi launch. Bật mặc định, có thể tắt riêng; khi tắt, tool theo contract executor cũ, JEV vẫn quyết định model/effort.

## Codemode

- Khi được cấp, `codemode` chỉ khám phá và gọi tool được cấp cho child. Nếu một tool được chọn chỉ có thể dùng qua `codemode`, tự thêm `codemode` nếu giới hạn cứng cho phép; không vì vậy cấp thêm tool khác.
- JEV chấm capability `codemode.models` riêng; chỉ cho phép nếu được chọn. Cấp `codemode` không tự cấp `models`.
- Tool điều phối model-only tiếp tục dùng qua model tool call thông thường, không giả định gọi được từ `codemode`.
- **Cần kiểm chứng:** host Pi và executor có thể thực thi việc giới hạn registry và `models` riêng hay không. Nếu không, báo blocker và đưa phương án cho user; không âm thầm bỏ yêu cầu.

## Lỗi và fallback

- JEV lỗi hoặc timeout toàn bộ: dùng model/effort caller hoặc executor default và tool caller + agent; cảnh báo parent và child. Giới hạn cứng và contract bắt buộc vẫn áp dụng.
- Kết quả hợp lệ một phần: áp dụng phần hợp lệ. Model hoặc effort không hợp lệ fallback riêng sang caller/default. Tool thiếu score hoặc score không hợp lệ không được JEV bổ sung, nhưng vẫn được cấp nếu nằm trong baseline hoặc contract và không bị chặn. Cảnh báo phần thiếu.
- Không gọi request JEV riêng chỉ để chấm tool. Ngưỡng score và việc có dùng confidence gate hay không cần benchmark và hiệu chuẩn trước khi chốt; không xem confidence là xác suất nếu chưa có bằng chứng.

## Tiêu chí nghiệm thu

| ID | Điều kiện kiểm thử |
|---|---|
| AC1 | Agent có `read`, caller yêu cầu `search`, JEV chọn `plugin/tool`: tập dự kiến chứa cả ba, không sửa file agent. |
| AC2 | Plugin mới có metadata được xét ở launch tiếp theo; plugin chưa có metadata không bị khẳng định là đã được xét. |
| AC3 | `excludeTools` chặn tool dù score cao hoặc caller yêu cầu; tool contract bắt buộc bị chặn khiến launch lỗi rõ ràng. |
| AC4 | JEV lỗi/timeout dùng baseline; thiếu score chỉ bỏ phần chọn thêm tương ứng; cảnh báo parent và child. |
| AC5 | Thiếu provider/tool được chọn: phần còn lại tiếp tục chạy, cảnh báo nêu tool/provider; không nhầm tool trùng tên giữa các nguồn. |
| AC6 | `codemode` chỉ gọi được tool đã cấp; capability `models` được xét riêng; phụ thuộc bị chặn không vượt ceiling. |
| AC7 | Caller chọn model/effort không bỏ qua JEV; khi tắt dynamic tools, model/effort vẫn theo cơ chế JEV hiện có. |
| AC8 | Integration test với provider mock và benchmark score có evidence; báo rõ chưa xác minh launch Pi thật nếu không chạy smoke test thật. |

## Kế hoạch sơ bộ — chờ duyệt

1. Kiểm tra contract giữa `pi-jev-pilot` và executor `pi-subagents`, metadata sẵn có, cách nạp provider, và khả năng giới hạn `codemode.models`. Ghi rõ blocker trước khi chọn cách sửa.
2. Thêm metadata tool và câu hỏi score vào request worker hiện tại; chọn ngưỡng dựa trên benchmark role/task/tool đại diện. Giữ model/effort fallback theo contract trên.
3. Mở rộng contract executor để hợp nhất các tập tool, giữ giới hạn cứng và contract bắt buộc; nạp provider cần thiết cho tool đã chọn, kiểm tra tool thực tế, truyền cảnh báo.
4. Hỗ trợ `codemode` và capability `models` theo quyền thực tế; giữ model-only tools theo contract hiện có.
5. Viết integration test theo AC1–AC8, chạy benchmark; báo riêng kết quả và giới hạn chưa chạy E2E. Chỉ cập nhật dependency/release sau khi các thay đổi executor được kiểm tra và duyệt.

**Điểm kiểm tra:** Source executor cài đặt `944128f` khác checkout `/Users/naicoi/Projects/pi-subagents` và `node_modules` trong project; xác định revision làm việc trước khi sửa. Không sửa installed release trực tiếp như nguồn chuẩn.

## Cấu trúc, lệnh và ranh giới

- Pilot: `src/worker-authority.ts`, `src/system-one.ts`, `src/worker-adapter.ts`; test tại `tests/`. Đây là điểm bắt đầu, không khẳng định danh sách file cuối cùng.
- Executor: checkout `pi-subagents` và contract child launch/tool plan; xác minh version trước khi sửa. Tài liệu spec này lưu tại `.scratch/jev-subagent-tools/spec.md` theo issue tracker local.
- Pilot validation: `bun run typecheck`, `bun run lint`, `bun run test`; test tập trung: `bun test tests/worker-adapter.test.ts tests/authoritative-effort.test.ts`. Lệnh executor phải xác định từ checkout/revision được chọn, không suy đoán.
- Theo style TypeScript và test hiện có; validate dữ liệu JEV, không làm mất lỗi hoặc vượt giới hạn cứng. Không ghi secret vào test/log. Thay đổi dependency hoặc triển khai đợi user duyệt kế hoạch.
- **Không coi tool allowlist là sandbox:** `bash` hoặc tool khác có thể thực hiện thao tác bên ngoài registry. Không hứa bảo mật filesystem/process từ chính sách chọn tool.

## Ghi chú kỹ thuật

Pilot phụ thuộc `pi-subagents` commit `944128f754d1bd7ce17cfd5c325f0018bebe2a67`. Installed `scout` có danh sách tool tĩnh; executor đã hỗ trợ nạp `codemode` khi được phép, nhưng tên tool không tự nạp provider. Pi `codemode` có `models` riêng. Các nhận xét dựa trên source, chưa xác minh bằng launch Pi thật.
