# 🎮 Pandakeyauto - Điều Khiển Điện Thoại Chơi Game Bằng Chuột & Bàn Phím PC

Ứng dụng Windows hiện đại điều khiển điện thoại Android & iPhone trực tiếp từ máy tính bằng chuột và bàn phím, độ trễ 0ms, không quảng cáo, tối ưu cho game mobile (WASD, Ngắm bắn, Phím kỹ năng).

---

## 🌟 Tính Năng Nổi Bật

- **Độ trễ siêu thấp (< 30ms / 0ms lag)**: Tích hợp lõi Scrcpy Engine và công nghệ ADB HID / OTG trực tiếp.
- **Tùy chọn Chiếu màn hình**:
  - *Không chiếu màn hình*: Chuột điều khiển trực tiếp trên màn hình thật của điện thoại, không tốn tài nguyên PC.
  - *Chiếu màn hình lên PC*: Tương tác chuột và phím như một màn hình máy tính thứ 2 (hỗ trợ 60fps - 120fps).
- **🐼 1-Click Kích Hoạt Panda Mouse Pro**: Tự động kích hoạt Panda Mouse Pro qua ADB chỉ bằng 1 nút bấm để gán phím WASD, chuột ngắm bắn.
- **Bộ đôi phím tắt khẩn cấp (Boss Key)**:
  - `Alt + X`: Tắt màn hình điện thoại (không khóa máy, game combat vẫn chạy ngầm) & thu nhỏ cửa sổ PC trong 0.1 giây.
  - `Alt + Z`: Khóa hẳn màn hình điện thoại bằng nút nguồn ảo & nhả chuột về máy tính.
- **Chuyển đổi chuột 2 chiều**:
  - `Alt + 3`: Đưa chuột từ máy tính sang điện thoại và ngược lại tức thì.
  - `Alt Trái`: Nhả chuột về máy tính.
  - `Ctrl + Alt + K`: Bật / Tắt điều khiển nhanh.
- **Tiện ích mở rộng**:
  - Đồng bộ văn bản (Copy link, mật khẩu từ PC dán thẳng vào điện thoại).
  - 1-Click Chụp ảnh màn hình điện thoại lưu về máy tính.
  - Mở nhanh website trên điện thoại từ máy tính.
  - Hỗ trợ kết nối không dây qua Hotspot Wi-Fi (không cần cắm cáp).
  - Tách riêng Tab hướng dẫn kết nối & điều khiển iPhone / iPad (Apple iOS).

---

## 🚀 Cách Cài Đặt & Chạy Ứng Dụng

1. **Yêu cầu**: Đã cài đặt [Node.js](https://nodejs.org/).
2. **Cài đặt thư viện**:
   ```bash
   npm install
   ```
3. **Khởi động ứng dụng**:
   - Cách 1: Nhấp đúp vào file `Chay_An_Khong_Cua_So_CMD.vbs` (chạy ẩn êm ru không hiện cửa sổ CMD).
   - Cách 2: Chạy lệnh `npm start`.

---

## 📱 Hướng Dẫn Kết Nối Điện Thoại (Android & Vivo / Xiaomi / Oppo)

1. Cắm cáp USB nối điện thoại với máy tính.
2. Vào **Cài đặt > Thông tin điện thoại > Nhấn 7 lần "Số hiệu bản dựng"** để mở menu Nhà phát triển.
3. Vào **Tùy chọn nhà phát triển**:
   - Bật **Gỡ lỗi USB** (USB Debugging).
   - Bật **Gỡ lỗi USB (Cài đặt bảo mật)** để cho phép chuột và bàn phím máy tính mô phỏng thao tác chạm.
4. Mở khóa điện thoại, tích chọn **"Luôn cho phép kết nối từ máy tính này"** và bấm **OK**.

---

## ⌨️ Bảng Phím Tắt Tiện Ích

| Phím Tắt | Chức Năng |
| :--- | :--- |
| <kbd>Alt</kbd> + <kbd>X</kbd> | **Boss Key**: Tắt màn hình điện thoại (game vẫn chạy ngầm) & Ẩn cửa sổ PC |
| <kbd>Alt</kbd> + <kbd>Z</kbd> | **Khóa Màn Hình Nhanh** điện thoại & Nhả chuột về PC |
| <kbd>Alt</kbd> + <kbd>3</kbd> | **Chuyển đổi chuột 2 chiều** giữa PC và Điện thoại |
| <kbd>Alt Trái</kbd> | Nhả chuột về máy tính |
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd> | Bật / Tắt điều khiển nhanh toàn hệ thống |
| <kbd>Chuột Trái</kbd> | Chạm / Bắn / Đánh / Kéo kỹ năng |
| <kbd>Chuột Phải</kbd> | Nút Quay Lại (Back Android) |
| <kbd>Chuột Giữa</kbd> | Về Màn Hình Chính (Home) |

---

## 📜 Giấy Phép
Dự án được phát hành theo giấy phép mã nguồn mở MIT.
