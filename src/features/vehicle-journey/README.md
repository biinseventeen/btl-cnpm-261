# Vehicle Journey & Reservation

- **Phụ trách (UI và logic):** Khải, theo file phân công Submission 4.
- **Kiểm tra UI so với Figma:** Lợi.
- Code hiện tại (`pages/`, `components/`, `src/store/vehicleJourneySlice.ts`) là bản nháp Lợi dựng theo Figma để cả nhóm chạy thử luồng xuyên module. Khải toàn quyền viết lại, sửa hoặc xóa.

Màn sinh viên đóng vai `S-02` (`src/lib/demoUser.ts`).

## Route

| Route | Màn hình | Frame Figma |
|---|---|---|
| `/student/vehicles` | Bản đồ Hub, danh sách xe, chi tiết xe (`?hubId=` chọn sẵn Hub) | VJ-01 `59:3` |
| `/student/vehicles/:vehicleId/reserve` | Xác nhận giữ xe, xe vừa bị người khác đặt | VJ-03 `67:2`, VJ-03e `161:3` |
| `/student/trips` | Phiếu đang giữ, phiếu hết hạn, hành trình đang đi, trả xe khi Hub đầy, tóm tắt | VJ-03f `161:202`, VJ-04 `68:2`, VJ-05 `68:295` |
| `/student/trips/pickup` | Quét QR nhận xe (bản desktop của frame mobile) | `113:11`, `113:70` |

## Store

| Action | Việc |
|---|---|
| `reserveSharedVehicle` | Xe AVAILABLE, pin > 20%, heartbeat còn hiệu lực → RESERVED, giữ 15 phút. Mỗi sinh viên một phiếu mở. Mã `VJ-YYMMDD-xxx` |
| `cancelVehicleReservation` | RESERVED → CANCELLED, xe về AVAILABLE |
| `pickUpVehicle` | Mã QR phải khớp mã xe → IN_USE, Hub giảm 1 chỗ đang đỗ, lưu pin lúc nhận |
| `toggleTripLock`, `reportTripIssue` | Tạm khóa khi đang đi; báo sự cố tạo incident |
| `returnSharedVehicle` | Hub đầy → `HUB_FULL`, hành trình giữ nguyên. Ưu tiên kết quả: mất heartbeat → DISCONNECTED; lỗi → UNAVAILABLE (cả hai tạo incident); pin ≤ 20% → PENDING_CHARGING + 1 yêu cầu sạc SYSTEM; còn lại AVAILABLE |
| `sweepVehicleReservations` | Phiếu quá hạn → EXPIRED, xe về AVAILABLE (chạy mỗi 5 giây qua `demoClock`) |
| `setVehicleTelemetry`, `tickVehicleTelemetry` | Bảng mô phỏng telemetry; pin giảm 0,4%/phút khi đang đi |

Test: `src/store/vehicleJourneySlice.test.ts`.

## Kịch bản demo

Tìm xe SM-016 ở Ga Metro → Đặt trước → Quét mã QR → Xác nhận nhận xe → chọn Hub đích Ký túc xá Khu B (đầy, nút trả bị khóa) → chọn Hub khác → bấm "Pin xe còn 15%" → Trả xe: xe sang Chờ sạc và có yêu cầu sạc mới trên `/operator/charging-queue`.
