# STTC Admin Frontend (Vanilla)

Frontend quan tri su dung HTML/CSS/JS thuan, ket noi den backend Spring Boot qua REST API.

## Chuc nang

- Quan ly CRUD chinh cho admin: `users`, `categories`, `products`, `orders`, `order-items`, `payments`, `reviews`, `notifications`, `contacts`
- Dang nhap bat buoc truoc khi vao admin
- Chi tai khoan co role `ADMIN` moi dang nhap duoc
- Phan trang danh sach (`page`, `size`)
- Tim nhanh tren danh sach cua trang hien tai
- Chuyen nhanh module bang sidebar
- Form tao/sua, xoa ban ghi
- Form co cac truong chon san (trang thai, phuong thuc thanh toan...) de nhap lieu nhanh hon
- Dashboard thong ke nhanh: tong user, tong don, don cho xu ly, doanh thu da thanh toan
- Bieu do thong ke: don hang theo trang thai, thanh toan theo trang thai, top san pham ban chay
- Ho tro loc thong ke theo thang (chon thang hoac xem tat ca)
- Upload anh tu may cho cac truong anh (`users.avatar`, `categories.image`, `products.primaryImage`)

## Chay nhanh

1. Chay backend Spring Boot tai thu muc `Backend`:

```powershell
.\mvnw.cmd spring-boot:run
```

2. Mo file `Frontend/index.html` bang Live Server (khuyen nghi) hoac static server bat ky.

Frontend su dung co dinh API:

- `http://localhost:8080/api/v1`

## Dang nhap admin

Frontend goi `POST /api/v1/auth/login` voi `email` va `password`.
Backend chi cap token neu user co role `ADMIN`.

Tai khoan mac dinh khi khoi dong backend lan dau:

- Email: `admin@sttc.local`
- Password: `admin123`

Sau khi dang nhap thanh cong, token duoc gui kem header:

- `Authorization: Bearer <token>`

## Upload anh va luu vao database

- Frontend goi `POST /api/v1/uploads/images` (multipart/form-data)
- Backend luu file vao thu muc `Backend/uploads`
- Backend tra duong dan public dang `/uploads/<fileName>`
- Frontend tu dien duong dan nay vao cac cot anh trong DB (vi du `users.avatar`, `categories.image`)
- Voi anh dai dien san pham, frontend tu dong dong bo sang bang `product_images`

## CORS

Backend da duoc bat CORS trong `SecurityConfig` cho cac origin local pho bien:

- `http://localhost:3000`
- `http://localhost:5500`
- `http://127.0.0.1:5500`
