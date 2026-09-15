@echo off
chcp 65001 >nul
title Pandakeyauto - Portable Standalone Launcher

echo ===================================================
echo   🎮 PANDAKEYAUTO - ĐIỀU KHIỂN ĐIỆN THOẠI PORTABLE
echo   (Chạy Offline 100% - Không cần cài Node.js)
echo ===================================================
echo.

:: Di chuyển vào thư mục chứa script
cd /d "%~dp0"

:: 1. Kiểm tra xem máy đích đã có Node.js chưa
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Tìm thấy Node.js trên máy đích.
    echo [*] Đang khởi động giao diện...
    start "" npm start
    exit
)

:: 2. Nếu máy đích chưa cài Node.js, khởi chạy lõi Standalone trực tiếp bằng Scrcpy + ADB
echo [THÔNG BÁO] Máy đích chưa cài Node.js.
echo [*] Tự động chuyển sang chế độ Standalone Offline trực tiếp...
echo.

if not exist "bin\scrcpy.exe" (
    echo [LỖI] Không tìm thấy thư mục bin\scrcpy.exe!
    pause
    exit
)

echo ---------------------------------------------------
echo MENU ĐIỀU KHIỂN OFFLINE:
echo [1] Bật điều khiển chuột & phím trực tiếp (0ms lag, không video)
echo [2] Chiếu màn hình điện thoại lên máy tính (Tương tác PC 60fps)
echo [3] 1-Click Kích hoạt Panda Mouse Pro
echo [4] Thoát
echo ---------------------------------------------------
set /p opt="Vui lòng chọn (1, 2 hoặc 3): "

if "%opt%"=="1" (
    echo [*] Đang kích hoạt điều khiển chuột phím vào điện thoại...
    echo [*] Bấm Alt để nhả chuột quay lại máy tính!
    start "" "bin\scrcpy.exe" -K -M --no-video-playback --stay-awake --window-title="Pandakeyauto - Vung Bat Chuot (Nhan Alt de nha chuot)"
    exit
)

if "%opt%"=="2" (
    echo [*] Đang chiếu màn hình điện thoại lên máy tính...
    start "" "bin\scrcpy.exe" --video-bit-rate=16M --max-fps=60 --stay-awake --always-on-top --window-title="Pandakeyauto - Man Hinh Dien Thoai (Alt de nha chuot)"
    exit
)

if "%opt%"=="3" (
    echo [*] Đang gửi lệnh kích hoạt Panda Mouse Pro...
    "bin\adb.exe" shell "sh /sdcard/Android/data/com.panda.mouse/files/scripts/activate.sh || sh /data/local/tmp/activate.sh"
    echo.
    echo [*] Hoàn tất! Mở app Panda Mouse trên điện thoại để kiểm tra.
    pause
    exit
)

exit
