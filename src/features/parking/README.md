# Parking & Private EV

- **UI/presentation:** Lợi (`pages/`, `components/`, `ui.tsx`).
- **Business logic:** Thịnh (`src/store/parkingSlice.ts`). Bản hiện tại do Lợi viết trước khi đổi phân công, Thịnh review và tiếp quản.

Đặt chỗ đỗ xe cá nhân, check-in theo cảm biến, giám sát ô đỗ và gửi yêu cầu sạc xe cá nhân. Bám Figma `ui-mockup`, section "Sửa Sub2 + UI ngoại lệ Sub3 · Bùi Hữu Lợi".

## Route

| Route | Màn hình | Frame Figma |
|---|---|---|
| `/student/parking` | Đặt chỗ, card trạng thái đơn (gồm hết hạn) | PK-01_v2 `144:3`, PK-01g `146:2` |
| `/student/parking/:reservationId` | Check-in, sơ đồ ô, chờ cảm biến, check-in thất bại | PK-01e `145:2`, PK-01f `145:247` |
| `/student/private-ev` | Gửi yêu cầu sạc | PK-02_v2 `146:185` |
| `/student/private-ev/:requestId` | Chi tiết yêu cầu, lịch sạc đã thay đổi, lịch sử | PK-02f `147:2` |
| `/operator/parking-slots` | Giám sát ô đỗ + mô phỏng cảm biến, nạp lại dữ liệu demo | (không có frame) |

`/parking` cũ chuyển về `/student/parking`. Màn sinh viên đóng vai `S-02` (`constants.ts`).

## Store

Action nằm ở `src/store/parkingSlice.ts`, test ở `src/store/parkingSlice.test.ts` (`npm test`).

| Action | Việc |
|---|---|
| `reserveParking` | Giữ 1 đơn vị sức chứa Hub (`heldSlots + 1`), chưa gán ô. Chặn Hub đầy, đơn trùng tại Hub, giờ đến ngoài 2 giờ tới |
| `cancelParkingReservation` | HELD / SLOT_ASSIGNED → CANCELLED, trả sức chứa và ô |
| `checkInParking` | Chọn ô FREE có cảm biến ONLINE (theo mã ô) → SLOT_ASSIGNED, giữ ô 10 phút. Không có ô → CHECK_IN_FAILED (`NO_PHYSICAL_SLOT` / `SENSOR_UNAVAILABLE`), trả sức chứa, gọi `raiseIncident` |
| `reportSlotSensor(slotId, 'OCCUPIED' \| 'FREE')` | Xe vào đúng ô đã cấp → ARRIVED (`held − 1`, `occupied + 1`); xe rời → COMPLETED. Xe đỗ không có đơn → incident |
| `setSlotSensorStatus` | ONLINE / STALE / FAULT; FAULT sinh incident |
| `sweepParkingExpiry` | HELD quá `arrival + 15'` → EXPIRED; ô giữ quá 10 phút → nhả ô, đơn về HELD (hoặc EXPIRED nếu đơn cũng hết hạn). Chạy mỗi 5 giây qua `src/app/demoClock.ts` |
| `checkOutParking` | ARRIVED → COMPLETED |
| `submitPrivateEvChargingRequest` | Tạo `ChargingRequest` nguồn `STUDENT`, trạng thái `WAITING`, không gán cổng. Pin lấy từ telemetry (≤ 30 phút) hoặc nhập tay có xác nhận (`batteryVerified = false`) |
| `cancelChargingRequest` | Hủy request của chính mình khi còn chờ / đã xếp lịch; trả cổng nếu đang ASSIGNED cho xe đó |

`chargingRequestEvents` ghi lịch sử request của sinh viên bằng cách theo dõi mọi thay đổi của `chargingRequests` (kể cả do scheduler của Kiệt), dùng cho màn PK-02f.

## Dữ liệu mẫu

H1 có 16 ô A-01 đến A-16 (12 có xe, A-03 mất tín hiệu, A-06 bảo trì, A-12 và A-14 trống). S-02 có PE-018 (không có dữ liệu pin) và PE-021 (pin 35%). H3 đầy sẵn để diễn ca Hub đầy.

## Kịch bản demo (bước 5)

1. `/student/parking`: chọn H1, PE-018 → Xác nhận đặt chỗ đỗ → Check-in khi đến Hub → nhận ô A-12.
2. Bấm "Cảm biến: xe đã vào ô A-12" → đơn ARRIVED, Dashboard H1 tăng 1 xe.
3. `/student/private-ev`: PE-018, nhập pin 18, tick xác nhận → Gửi yêu cầu sạc → request vào queue của Charging.

Ngoại lệ: chọn H3 (Hub đầy); trên `/operator/parking-slots` chuyển cảm biến B-07 sang Lỗi rồi đặt và check-in ở H2 (check-in thất bại); không check-in tới hạn (hết hạn).

## Còn thiếu

- Màn đăng ký xe mới, bản mobile, tab "Xe dùng chung" chỉ là hướng dẫn.
- Dời lịch (`SCHEDULED → WAITING`) và `EXPIRED` do scheduler của Kiệt phát; phía này chỉ hiển thị.
