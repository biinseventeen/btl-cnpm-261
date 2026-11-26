# Smart E-Mobility Hub — L01-N8

Starter repository cho MVP demo môn CO3001. UI hiện tại chỉ là skeleton minh họa luồng dữ liệu; các thành viên cần thay phần trình bày bằng màn hình Figma đã có.

## Tech stack
- React + Vite + TypeScript
- Tailwind CSS v4 (Vite plugin)
- React Router v7
- Zustand v5
- Lucide React

## Yêu cầu
- Node.js 22.12+ (hoặc phiên bản Vite hỗ trợ)
- npm
- Git

## Chạy local
```bash
npm install
npm run dev
```

Mở URL Vite hiển thị trong terminal (thường là http://localhost:5173).

## Kiểm tra build
```bash
npm run build
npm run preview
```

## Routes hiện có
- `/operator` — Operation dashboard / simulation preview
- `/student/vehicles` — Vehicle Journey & Reservation
- `/charging` — Charging queue & points
- `/parking` — Parking & Private EV

## Cấu trúc mã nguồn
```text
src/
  app/                    # Router và App root
  components/layout/      # App shell, navigation
  components/shared/      # Component dùng chung
  features/               # Mỗi thành viên sở hữu một feature
    vehicle-journey/      # Khải
    charging/             # Kiệt
    parking/              # Lợi
    operation/            # Thịnh
  store/                  # Shared Zustand store
  types/                  # Shared data contract
  data/                   # Mock/seed data
```

## Quy ước làm việc nhóm
1. Không tạo project Vite riêng. Tất cả cùng phát triển trên repository này.
2. Mỗi thành viên chỉ chỉnh sửa trực tiếp trong `src/features/<module>` và file style/component riêng của module, trừ khi đã thống nhất thay đổi file chung.
3. `src/types/index.ts` là data contract chung. Muốn thêm/sửa field hoặc enum phải trao đổi với Thịnh trước khi merge.
4. `src/store/useMobilityStore.ts` là shared state. Không tạo bản sao dữ liệu Hub/Vehicle/ChargingRequest trong từng feature.
5. `src/data/mockData.ts` là dữ liệu khởi tạo thống nhất; không hard-code cùng một thực thể ở nhiều nơi.
6. Mọi action cần thay đổi shared state thông qua store action. UI không tự sửa object trực tiếp.
7. Không push thẳng lên `main`. Tạo feature branch và merge qua Pull Request hoặc nhờ Thịnh review.
8. Trước khi push, phải chạy `npm run build` và xử lý lỗi TypeScript.

## Branch convention
- `main`: bản tích hợp ổn định
- `feat/operation-*`: Thịnh
- `feat/vehicle-journey-*`: Khải
- `feat/charging-*`: Kiệt
- `feat/parking-*`: Lợi

## Khởi tạo Git và đẩy lên GitHub
Trong thư mục project, chạy:
```bash
git init
git add .
git commit -m "chore: initialize Smart E-Mobility Hub MVP"
git branch -M main
```

Tạo repository rỗng trên GitHub với tên `smart-emobility-hub` (không tạo README, .gitignore hay license từ GitHub), sau đó thay `<YOUR_GITHUB_USERNAME>` bằng username của bạn:

```bash
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/smart-emobility-hub.git
git push -u origin main
```

Nếu repository thuộc GitHub Organization của nhóm, thay URL bằng URL repository của Organization.

## Thành viên clone project
```bash
git clone https://github.com/<YOUR_GITHUB_USERNAME>/smart-emobility-hub.git
cd smart-emobility-hub
npm install
npm run dev
```

## Demo store hiện tại
- Reserve một vehicle khả dụng.
- Return vehicle với battery 15% để tạo yêu cầu sạc hệ thống.
- Assign một charging point khả dụng cho request đang WAITING.
- Tạo parking reservation.
- Apply What-if preview; store revalidates số xe khả dụng trước khi tạo DispatchOrder. Đây chỉ là logic demo phía client, chưa thay thế transaction/backend thực tế.

## Ghi chú
- Dữ liệu chỉ nằm trong memory của Zustand và reset khi reload. Local Storage/backend chưa được nối.
- Chưa có authentication, phân quyền, API, database, MQTT hay tích hợp IoT thật.
- Các nút mô phỏng là scaffold để nhóm phát triển tiếp, không phải sản phẩm hoàn chỉnh.
