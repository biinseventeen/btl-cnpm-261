# Smart E-Mobility Hub — L01-N8

MVP frontend cho đồ án CO3001. Ứng dụng dùng mock data và Zustand để minh họa các luồng xe điện, sạc, bãi đỗ và vận hành. Dữ liệu chỉ lưu trong bộ nhớ trình duyệt và được khởi tạo lại khi tải trang.

## Công nghệ và chạy ứng dụng

- React 19, Vite 7, TypeScript
- Tailwind CSS v4, React Router v7, Zustand v5, Lucide React
- Yêu cầu Node.js 22.12+ và npm

```bash
npm install
npm run dev
```

Kiểm tra bản production bằng `npm run build`; chạy thử bằng `npm run preview`.

## Cấu trúc và quyền sở hữu

```text
src/
  app/                         # App root và route definitions
  components/layout/            # App shell và navigation
  components/shared/            # UI dùng chung
  data/mockData.ts              # Seed data dùng chung
  features/
    vehicle-journey/            # UI: Lợi; business logic: Khải
    charging/                   # UI: Lợi; business logic: Kiệt
    parking/                    # UI: Lợi; business logic: Thịnh
    operation/                  # UI: Lợi; business logic: Thịnh
  store/useMobilityStore.ts     # Shared state và store actions
  types/index.ts                # Shared data contracts
```

Lợi phụ trách mọi page/presentation `.tsx`, shared components, layout, routing, styles và nối UI với store actions. Khải phụ trách logic Vehicle Journey; Kiệt phụ trách logic Charging; Thịnh phụ trách logic Parking/Private EV và Operation/Simulation, cùng shared types, store, mock data và integration.

Các route hiện có: `/operator`, `/student/vehicles`, `/charging`, `/parking`. Không tạo app hoặc bản sao dữ liệu riêng cho từng feature. UI đọc/cập nhật domain state qua `useMobilityStore`; thay đổi shared types/store/mock data cần được thống nhất và cập nhật các consumer liên quan.

## Git workflow để làm việc và tự push

Nhánh chuẩn của nhóm: `main` (ổn định), `integration` (tích hợp), `feat/thinh-business-logic`, `feat/vehicle-journey-logic`, `feat/charging-logic`, `feat/frontend`. Tạo nhánh công việc từ `integration`, chỉ sửa phần thuộc trách nhiệm của mình, rồi mở PR vào `integration`.

Lệnh bắt đầu một nhánh Thịnh mới:

```bash
git status --short --branch
git switch integration
git pull --ff-only origin integration
git switch -c feat/thinh-business-logic
```

Sau khi sửa và build thành công, stage đúng các file bạn đã xem lại rồi commit và push nhánh feature:

```bash
npm run build
git status --short
git add README.md src/features/operation/README.md src/features/parking/README.md src/features/charging/README.md src/features/vehicle-journey/README.md
git commit -m "docs(workflow): align repository guidance with AGENTS.md"
git push -u origin feat/thinh-business-logic
```

Nếu nhánh feature đã tồn tại, không chạy lại `switch -c`. Cập nhật nhánh trước khi push bằng:

```bash
git fetch origin
git merge origin/integration
git push
```

Để giảm xung đột, không làm trực tiếp trên `main`/`integration`, không sửa file ngoài phạm vi ownership nếu chưa phối hợp, và báo trước khi thay đổi `src/types/index.ts`, `src/store/useMobilityStore.ts`, `src/data/mockData.ts`, routes hoặc shared UI. Nếu Git báo conflict, dừng lại xử lý và kiểm tra từng file trước khi commit; không dùng `reset`, force-push hoặc ghi đè thay đổi của người khác. Workflow này giảm khả năng xung đột nhưng không thể bảo đảm tuyệt đối khi nhiều người cùng sửa một file.

## Quy ước commit

Dùng Conventional Commits: `<type>(<scope>): <mô tả ngắn>`. Ví dụ:

- `feat(parking): add reservation check-in flow`
- `fix(operation): revalidate dispatch capacity`
- `chore(store): keep demo seed data deterministic`
- `docs(workflow): align repository guidance with AGENTS.md`

Các type thường dùng: `feat`, `fix`, `docs`, `refactor`, `chore`. Không commit file build, secrets hoặc `.env`.

## Phạm vi MVP

Đây là frontend demo dùng mock data; chưa có backend, database, authentication, MQTT hay kết nối IoT thật. Store hiện tại chạy trong bộ nhớ và reset khi reload.
