# Charging & Resource Management

- **Phụ trách (UI và logic):** Kiệt, theo file phân công Submission 4.
- **Kiểm tra UI so với Figma:** Lợi.
- Code hiện tại (`pages/`, `components/`, `src/store/chargingSlice.ts`) là bản nháp Lợi dựng theo Figma để cả nhóm chạy thử luồng xuyên module. Kiệt toàn quyền viết lại, sửa hoặc xóa.

## Route

| Route | Màn hình | Frame Figma |
|---|---|---|
| `/operator/hubs` | Theo dõi xe và cổng sạc theo Hub, thao tác cổng | `112:4` |
| `/operator/charging-queue` | Hàng đợi sạc, điều chỉnh thủ công có lý do, gán cổng | `112:621` |
| `/operator/dispatch` | Tạo và bàn giao lệnh điều phối xe giữa Hub | `112:330` |

## Quy tắc

- Gửi yêu cầu sạc không gán cổng. Cổng chỉ gán khi đang AVAILABLE và cùng Hub; `ASSIGNED` là giữ chỗ, chỉ sang `CHARGING` khi xe kết nối (`startCharging`).
- Thứ tự hàng đợi: pin hiệu lực thấp hơn trước (pin nhập tay chưa xác minh tính tối thiểu 21%, nên không được ưu tiên cao), rồi chờ lâu hơn. Thứ tự đã chỉnh tay được giữ, yêu cầu mới chèn theo quy tắc.
- `moveChargingRequest` bắt buộc lý do ≥ 5 ký tự, lưu người thao tác, thứ tự cũ/mới.
- `reportChargingPointFault`: cổng → ERROR, yêu cầu đang dùng quay lại hàng đợi, tạo incident. Khôi phục qua màn Sự cố.
- Điều phối: chỉ xe sẵn sàng, pin > 20%, heartbeat còn hiệu lực; Hub nguồn giữ tối thiểu 3 xe; Hub đích phải đủ chỗ ngay lúc tạo lệnh. Tạo lệnh: nguồn `occupied − n`, đích `incomingReserved + n`; bàn giao: đích `incoming − n`, `occupied + n`; hủy hoàn lại.

Test: `src/store/chargingSlice.test.ts`.
