let currentDeviceId = null;
let isControlling = false;

// Header elements
const elStatusDot = document.getElementById('statusDot');
const elDeviceText = document.getElementById('deviceText');
const elFooterLog = document.getElementById('footerLog');

// Tab Navigation
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-content');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const targetId = btn.getAttribute('data-tab');
    document.getElementById(targetId).classList.add('active');
  });
});

// Game Tab elements
const elBtnToggleControl = document.getElementById('btnToggleControl');
const elBtnToggleTitle = document.getElementById('btnToggleTitle');
const elBtnToggleSub = document.getElementById('btnToggleSub');
const elBtnStop = document.getElementById('btnStop');
const elBtnActivatePanda = document.getElementById('btnActivatePanda');

const elChkMirrorScreen = document.getElementById('chkMirrorScreen');
const elChkForwardAudio = document.getElementById('chkForwardAudio');
const elChkStayAwake = document.getElementById('chkStayAwake');

// Tab 2 elements
const elTxtSendText = document.getElementById('txtSendText');
const elBtnSendText = document.getElementById('btnSendText');
const elBtnScreenshot = document.getElementById('btnScreenshot');
const elTxtUrl = document.getElementById('txtUrl');
const elBtnOpenUrl = document.getElementById('btnOpenUrl');
const elTxtWifiIp = document.getElementById('txtWifiIp');
const elBtnConnectWifi = document.getElementById('btnConnectWifi');
const elBtnRestartAdb = document.getElementById('btnRestartAdb');
const elBtnRefresh = document.getElementById('btnRefresh');

function updateFooterLog(msg) {
  const time = new Date().toLocaleTimeString();
  elFooterLog.textContent = `[${time}] ${msg}`;
}

// IPC listeners
window.api.onOtgLog((msg) => {
  updateFooterLog(msg.trim());
});

window.api.onOtgStatus((status) => {
  if (!status.running) {
    setControllingState(false);
    updateFooterLog(`Đã dừng điều khiển (mã: ${status.code})`);
  }
});

window.api.onRequestStartControl(() => {
  updateFooterLog('Đang chuyển chuột sang điện thoại...');
  handleToggleControl();
});

function setControllingState(active) {
  isControlling = active;
  elBtnStop.disabled = !active;

  if (active) {
    elStatusDot.className = 'dot connected';
    elBtnToggleControl.classList.add('running');
    elBtnToggleTitle.textContent = 'ĐANG ĐIỀU KHIỂN (BẤM ĐỂ DỪNG)';
    elBtnToggleSub.textContent = 'Bấm Alt+3 để đổi chuột qua lại | Alt Trái để nhả chuột';
    updateFooterLog('ĐANG ĐIỀU KHIỂN! Bấm Alt+3 để chuyển đổi chuột giữa PC và Điện thoại.');
  } else {
    elBtnToggleControl.classList.remove('running');
    elBtnToggleTitle.textContent = 'BẬT ĐIỀU KHIỂN';
    elBtnToggleSub.textContent = 'Phím tắt nhanh: Ctrl + Alt + K | Đổi chuột: Alt + 3';
    updateDeviceList();
  }
}

async function updateDeviceList() {
  try {
    const res = await window.api.getDevices();

    if (res.success && res.devices.length > 0) {
      const dev = res.devices[0];
      currentDeviceId = dev.id;
      const typeLabel = dev.isWifi ? 'Wi-Fi' : 'USB';
      elDeviceText.textContent = `Đã kết nối: ${dev.model || 'Điện thoại'} (${typeLabel})`;
      elStatusDot.className = 'dot connected';
    } else {
      currentDeviceId = null;
      elStatusDot.className = 'dot';
      elDeviceText.textContent = 'Chưa cắm điện thoại qua USB';
    }
  } catch (err) {
    updateFooterLog(`Lỗi kiểm tra thiết bị: ${err.message}`);
  }
}

// Bắt đầu hoặc cập nhật phiên điều khiển
async function startCurrentControl() {
  const mirror = elChkMirrorScreen.checked;
  updateFooterLog(`Đang kích hoạt: ${mirror ? 'Chiếu màn hình PC (Tương tác như màn hình máy tính)' : 'Chuột & Phím trực tiếp (0ms lag)'}...`);

  const res = await window.api.startControl({
    deviceId: currentDeviceId,
    mirrorScreen: elChkMirrorScreen.checked,
    stayAwake: elChkStayAwake.checked,
    forwardAudio: elChkForwardAudio.checked
  });

  if (res.success) {
    setControllingState(true);
    updateFooterLog(res.message);
  } else {
    updateFooterLog(`Lỗi: ${res.message}`);
  }
}

async function handleToggleControl() {
  if (isControlling) {
    updateFooterLog('Đang ngắt kết nối điều khiển...');
    await window.api.stopControl();
    setControllingState(false);
  } else {
    await startCurrentControl();
  }
}

elBtnToggleControl.addEventListener('click', handleToggleControl);
elBtnStop.addEventListener('click', async () => {
  await window.api.stopControl();
  setControllingState(false);
});

// ⭐ TÍNH NĂNG MỚI: TÍCH VÀO CHECKBOX LÀ ĂN NGAY LẬP TỨC
elChkMirrorScreen.addEventListener('change', async () => {
  if (isControlling) {
    updateFooterLog('Đang chuyển đổi chế độ hiển thị màn hình ngay lập tức...');
    await startCurrentControl(); // Tự động reload sang chế độ truyền màn hình hoặc ngược lại ngay lập tức
  } else {
    updateFooterLog(`Đã chọn: ${elChkMirrorScreen.checked ? 'Bật chiếu màn hình lên PC' : 'Tắt chiếu màn hình (0ms lag)'}. Bấm Bật điều khiển để bắt đầu.`);
  }
});

// Nút 1-Click kích hoạt Panda Mouse Pro
elBtnActivatePanda.addEventListener('click', async () => {
  updateFooterLog('Đang kích hoạt Panda Mouse Pro qua ADB...');
  elBtnActivatePanda.textContent = '⏳ Đang kích hoạt Panda Mouse...';
  elBtnActivatePanda.disabled = true;

  const res = await window.api.activatePanda({ deviceId: currentDeviceId });
  updateFooterLog(res.message);
  alert(res.message);

  elBtnActivatePanda.textContent = '✅ ĐÃ KÍCH HOẠT PANDA MOUSE (BẤM LẠI NẾU CẦN)';
  elBtnActivatePanda.disabled = false;
});

// Gửi văn bản từ máy tính sang điện thoại
elBtnSendText.addEventListener('click', async () => {
  const text = elTxtSendText.value.trim();
  if (!text) return;
  updateFooterLog('Đang dán văn bản vào điện thoại...');
  const res = await window.api.sendTextToPhone({ deviceId: currentDeviceId, text });
  updateFooterLog(res.message);
  elTxtSendText.value = '';
});

// Chụp màn hình điện thoại lưu vào PC
elBtnScreenshot.addEventListener('click', async () => {
  updateFooterLog('Đang chụp ảnh màn hình điện thoại...');
  const res = await window.api.takeScreenshot({ deviceId: currentDeviceId });
  updateFooterLog(res.message);
  alert(res.message);
});

// Mở link URL trên điện thoại
if (elBtnOpenUrl) {
  elBtnOpenUrl.addEventListener('click', async () => {
    const url = elTxtUrl.value.trim();
    if (!url) return;
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    const res = await window.api.openUrlOnPhone({ deviceId: currentDeviceId, url: finalUrl });
    updateFooterLog(res.message);
    elTxtUrl.value = '';
  });
}

// Tab 2 actions
elBtnRestartAdb.addEventListener('click', async () => {
  updateFooterLog('Đang khởi động lại ADB...');
  const res = await window.api.restartAdb();
  updateFooterLog(res.message);
  updateDeviceList();
});

elBtnRefresh.addEventListener('click', () => {
  updateFooterLog('Đang quét lại cổng USB...');
  updateDeviceList();
});

elBtnConnectWifi.addEventListener('click', async () => {
  const ip = elTxtWifiIp.value.trim();
  updateFooterLog('Đang thử kết nối không dây...');
  const res = await window.api.connectWifi({ deviceId: currentDeviceId, ipAddress: ip });
  updateFooterLog(res.message);
  updateDeviceList();
});

// Phím Android nhanh
document.querySelectorAll('.btn-quick').forEach(btn => {
  btn.addEventListener('click', async () => {
    const keycode = btn.getAttribute('data-key');
    if (!keycode) return;
    await window.api.sendKeyEvent({ deviceId: currentDeviceId, keycode });
    updateFooterLog(`Đã bấm phím: ${btn.textContent.trim()}`);
  });
});

// Quét tự động 3 giây/lần
setInterval(() => {
  if (!isControlling) {
    updateDeviceList();
  }
}, 3000);

// Khởi chạy quét lần đầu
updateDeviceList();
