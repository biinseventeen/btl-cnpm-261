# Operation & What-if Simulation

- **UI (`pages/`, `activity.ts`, `simulation.ts`):** Lợi, theo AGENTS.md.
- **Logic (`src/store/operationSlice.ts`):** Thịnh. Bản nháp hiện tại do Lợi viết khi dựng UI (PR `draft/store-logic`); Thịnh toàn quyền viết lại, miễn giữ chữ ký action mà UI đang gọi hoặc báo Lợi để sửa UI theo.

## Route

| Route | Màn hình | Frame Figma |
|---|---|---|
| `/operator` | Tổng quan mạng lưới, cảnh báo Hub ≥ 85% | `26:2` |
| `/operator/incidents` | Danh sách, chi tiết, quy trình xử lý sự cố | `26:181` |
| `/operator/simulation` | Cấu hình kịch bản, tham số sai (E1), quá 30 giây (E2) | `26:363`, `69:2`, `69:158` |
| `/operator/simulation/result` | Kết quả và khuyến nghị, khuyến nghị đã cũ | `148:2`, `148:311` |

## Sự cố

`raiseIncident` đánh mã `INC-xxx`, có lịch sử. Luồng: OPEN → `notifyTechnician` → `acknowledgeIncident` (IN_PROGRESS) → `restoreIncidentAsset` (RESOLVED và khôi phục tài nguyên: xe về AVAILABLE hoặc Chờ sạc kèm yêu cầu sạc nếu pin ≤ 20%; cổng sạc về Trống; cảm biến ô đỗ về ONLINE). `resolveIncident` chỉ đóng phiếu, không đụng tài nguyên.

## Mô phỏng

- Giới hạn: mức tăng 0–300%, thời gian 15–120 phút, lượt thêm 0–200. Thời gian ước tính = 0,02 × số Hub × phút × (1 + mức tăng/100); trên 30 giây là TIMEOUT. Phạm vi khu vực = 3 Hub.
- `simulate()` là hàm thuần trên snapshot; `runSimulation` không sửa dữ liệu thật (có test).
- `applySimulationRecommendations` kiểm tra lại từng khuyến nghị với dữ liệu thật: đúng thì APPLIED (điều phối tạo lệnh `origin: 'SIMULATION'`), sai thì STALE kèm lý do. Số xe điều phối không vượt số chỗ trống thật của Hub đích lúc chạy.
- Bảng "7 xe vừa được thuê" trên màn kết quả dùng để diễn ca khuyến nghị đã cũ.

Test: `src/store/operationSlice.test.ts`.
