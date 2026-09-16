let currentDeviceId = null;
let isControlling = false;
let profilesData = null;
let activeProfile = null;
let activeMode = null;

let crosshairConfig = {
  enabled: false,
  type: 'cross',
  color: '#00ff66',
  size: 30,
  thickness: 2,
  gap: 5
};
let isCoolerActive = false;
let isRapidFireActive = false;

// Multi-device & VIP Elements
const elSelDeviceList = document.getElementById('selDeviceList');
const elBtnBoostDevice = document.getElementById('btnBoostDevice');
const elBtnRestoreAnim = document.getElementById('btnRestoreAnim');
const elBtnToggleRapidFire = document.getElementById('btnToggleRapidFire');
const elSelRapidCps = document.getElementById('selRapidCps');

// Audio Synthesizer cho hiệu ứng âm thanh VIP khi đổi chế độ
const audioCtx = (typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined')
  ? new (window.AudioContext || window.webkitAudioContext)()
  : null;

function playSoundCue(type = 'mode') {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'mode') {
      // 2 nốt beep êm ái báo đổi chế độ thành công
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.00, now + 0.08); // A5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'activate') {
      // Âm thanh kích hoạt công nghệ
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {}
}

// Elements
const elStatusDot = document.getElementById('statusDot');
const elDeviceText = document.getElementById('deviceText');
const elFooterLog = document.getElementById('footerLog');

// Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-content');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const targetId = btn.getAttribute('data-tab');
    const targetPane = document.getElementById(targetId);
    if (targetPane) targetPane.classList.add('active');
  });
});

// Controls: 2 Nút Chiếu Màn Hình Tách Bạch & Panda
const elBtnStartMirror = document.getElementById('btnStartMirror');
const elBtnMirrorTitle = document.getElementById('btnMirrorTitle');
const elBtnMirrorSub = document.getElementById('btnMirrorSub');
const elBtnStopMirror = document.getElementById('btnStopMirror');
const elBtnActivatePanda = document.getElementById('btnActivatePanda');

// Add Custom Game Elements
const elBtnToggleAddGame = document.getElementById('btnToggleAddGame');
const elAddGameBox = document.getElementById('addGameBox');
const elBtnCloseAddGame = document.getElementById('btnCloseAddGame');
const elTxtNewGameName = document.getElementById('txtNewGameName');
const elTxtNewGameIcon = document.getElementById('txtNewGameIcon');
const elSelNewGameCat = document.getElementById('selNewGameCat');
const elBtnConfirmAddGame = document.getElementById('btnConfirmAddGame');

// Profile & Mode Elements
const elGameSelectorGrid = document.getElementById('gameSelectorGrid');
const elLblProfileCategory = document.getElementById('lblProfileCategory');
const elBtnPrevMode = document.getElementById('btnPrevMode');
const elBtnNextMode = document.getElementById('btnNextMode');
const elLblModeIcon = document.getElementById('lblModeIcon');
const elLblModeName = document.getElementById('lblModeName');
const elLblModeTag = document.getElementById('lblModeTag');
const elLblModeDesc = document.getElementById('lblModeDesc');
const elBadgeFps = document.getElementById('badgeFps');
const elBadgeCodec = document.getElementById('badgeCodec');
const elBadgeBuffer = document.getElementById('badgeBuffer');
const elBadgeBitrate = document.getElementById('badgeBitrate');
const elBadgeSize = document.getElementById('badgeSize');

// Tuning Selects
const elSelCodec = document.getElementById('selCodec');
const elSelFps = document.getElementById('selFps');
const elSelDisplayBuffer = document.getElementById('selDisplayBuffer');
const elSelMaxSize = document.getElementById('selMaxSize');
const elSelBitrate = document.getElementById('selBitrate');
const elSelRenderDriver = document.getElementById('selRenderDriver');
const elSelMouseSpeed = document.getElementById('selMouseSpeed');
const elSelMouseMode = document.getElementById('selMouseMode');
const elSelTabStyle = document.getElementById('selTabStyle');
const elChkMirrorScreen = document.getElementById('chkMirrorScreen');
const elChkEnableControl = document.getElementById('chkEnableControl');
const elChkUhidInput = document.getElementById('chkUhidInput');
const elChkTurnScreenOff = document.getElementById('chkTurnScreenOff');
const elChkForwardAudio = document.getElementById('chkForwardAudio');
const elChkStayAwake = document.getElementById('chkStayAwake');

// GitHub Sync Elements
const elTxtGithubToken = document.getElementById('txtGithubToken');
const elBtnToggleTokenVisibility = document.getElementById('btnToggleTokenVisibility');
const elTxtGithubGistId = document.getElementById('txtGithubGistId');
const elBtnSyncUpload = document.getElementById('btnSyncUpload');
const elBtnSyncDownload = document.getElementById('btnSyncDownload');
const elBtnExportJson = document.getElementById('btnExportJson');
const elBtnSaveJsonFile = document.getElementById('btnSaveJsonFile');
const elTxtImportJson = document.getElementById('txtImportJson');
const elBtnImportJson = document.getElementById('btnImportJson');
const elProfileListOverview = document.getElementById('profileListOverview');

// VIP Elements
const elBtnToggleCrosshair = document.getElementById('btnToggleCrosshair');
const elCrosshairStatusText = document.getElementById('crosshairStatusText');
const elPreviewCrosshairSvg = document.getElementById('previewCrosshairSvg');
const elRngCrosshairSize = document.getElementById('rngCrosshairSize');
const elLblCrosshairSize = document.getElementById('lblCrosshairSize');
const elRngCrosshairGap = document.getElementById('rngCrosshairGap');
const elLblCrosshairGap = document.getElementById('lblCrosshairGap');
const elBtnToggleCooler = document.getElementById('btnToggleCooler');
const elCoolerStatusBadge = document.getElementById('coolerStatusBadge');

// Utilities Elements
const elTxtSendText = document.getElementById('txtSendText');
const elBtnSendText = document.getElementById('btnSendText');
const elBtnScreenshot = document.getElementById('btnScreenshot');
const elTxtUrl = document.getElementById('txtUrl');
const elBtnOpenUrl = document.getElementById('btnOpenUrl');
const elBtnRestartAdb = document.getElementById('btnRestartAdb');
const elBtnRefresh = document.getElementById('btnRefresh');

function updateFooterLog(msg) {
  const time = new Date().toLocaleTimeString();
  elFooterLog.textContent = `[${time}] ${msg}`;
}

// ================= IPC LISTENERS =================
window.api.onOtgLog((msg) => {
  updateFooterLog(msg.trim());
});

window.api.onOtgStatus((status) => {
  if (!status.running) {
    setControllingState(false);
    if (status.code !== 0 && status.code !== null && status.code !== undefined) {
      updateFooterLog(`⚠️ Scrcpy đã dừng (Mã: ${status.code})${status.error ? ': ' + status.error : ''}`);
      if (status.error && status.error.includes('unauthorized')) {
        alert('⚠️ Điện thoại chưa được cấp quyền!\n\nVui lòng mở khóa điện thoại và chọn "Cho phép gỡ lỗi USB" (Allow USB debugging).');
      } else if (status.error && (status.error.includes('offline') || status.error.includes('closed'))) {
        alert('⚠️ Thiết bị bị ngắt kết nối hoặc ở chế độ Offline. Vui lòng kiểm tra lại dây cáp USB!');
      }
    } else {
      updateFooterLog(`Đã dừng điều khiển.`);
    }
  }
});

window.api.onRequestStartControl(() => {
  updateFooterLog('Đang khởi động điều khiển...');
  handleToggleControl();
});

// Lắng nghe khi bấm phím nóng Alt+Left / Alt+Right đổi chế độ
window.api.onModeChanged((result) => {
  if (result && result.mode) {
    activeProfile = result.profile;
    activeMode = result.mode;
    playSoundCue('mode');
    updateModeDisplay();
    updateFooterLog(`🎮 Đã chuyển sang [${result.profile.name} - ${result.mode.name}]!`);
    
    // Nếu đang điều khiển và có thay đổi cấu hình, có thể reload lại để áp dụng tức thì
    if (isControlling) {
      updateFooterLog('⚡ Đang nạp cấu hình tối ưu mới cho phiên điều khiển hiện tại...');
      startCurrentControl();
    }
  }
});

// ================= TRẠNG THÁI ĐIỀU KHIỂN (2 NÚT BẮT ĐẦU VÀ DỪNG LẠI) =================
function setControllingState(active) {
  isControlling = active;
  if (elBtnStopMirror) {
    elBtnStopMirror.disabled = !active;
    if (active) {
      elBtnStopMirror.classList.add('active-stop');
    } else {
      elBtnStopMirror.classList.remove('active-stop');
    }
  }

  if (active) {
    elStatusDot.className = 'dot connected';
    if (elBtnStartMirror) elBtnStartMirror.classList.add('running');
    if (elBtnMirrorTitle) elBtnMirrorTitle.textContent = `ĐANG CHIẾU [${activeProfile ? activeProfile.name : 'GAME'}] (BẤM ĐỂ NẠP LẠI)`;
    if (elBtnMirrorSub) elBtnMirrorSub.textContent = 'Phím: Alt / F1 (Đổi chuột) | Alt+Right/Left (Đổi chế độ) | Alt+X (Boss Key)';
    updateFooterLog('🎮 ĐANG ĐIỀU KHIỂN & CHIẾU MÀN HÌNH! Nhấn Alt hoặc F1 để chuyển đổi chuột giữa ĐT & PC.');
  } else {
    if (elBtnStartMirror) elBtnStartMirror.classList.remove('running');
    if (elBtnMirrorTitle) elBtnMirrorTitle.textContent = 'BẮT ĐẦU CHIẾU MÀN HÌNH';
    if (elBtnMirrorSub) elBtnMirrorSub.textContent = 'Chiếu lên PC & Tương tác chuột phím (Phím tắt: Alt / F1 đổi chuột)';
    updateDeviceList();
  }
}

async function updateDeviceList() {
  try {
    const res = await window.api.getDevices();
    if (res.success && res.devices.length > 0) {
      // Cập nhật dropdown thiết bị
      if (elSelDeviceList) {
        const previousVal = elSelDeviceList.value;
        elSelDeviceList.innerHTML = '';
        res.devices.forEach(dev => {
          const opt = document.createElement('option');
          opt.value = dev.id;
          const statusSuffix = dev.state === 'unauthorized' ? ' [⚠️ Chưa cấp quyền]' : '';
          opt.textContent = `${dev.model || 'Điện thoại'} (${dev.isWifi ? 'Wi-Fi' : 'USB'})${statusSuffix}`;
          elSelDeviceList.appendChild(opt);
        });

        if (res.devices.some(d => d.id === currentDeviceId)) {
          elSelDeviceList.value = currentDeviceId;
        } else if (res.devices.some(d => d.id === previousVal)) {
          elSelDeviceList.value = previousVal;
          currentDeviceId = previousVal;
        } else {
          currentDeviceId = res.devices[0].id;
          elSelDeviceList.value = currentDeviceId;
        }
      }

      const activeDev = res.devices.find(d => d.id === currentDeviceId) || res.devices[0];
      currentDeviceId = activeDev.id;
      const typeLabel = activeDev.isWifi ? 'Wi-Fi' : 'USB';
      if (activeDev.state === 'unauthorized') {
        elDeviceText.textContent = `${activeDev.model || 'Điện thoại'} (⚠️ Cần bấm "Cho phép" trên màn hình)`;
        elStatusDot.className = 'dot';
      } else {
        elDeviceText.textContent = `${activeDev.model || 'Điện thoại'} (${typeLabel}) - Sẵn sàng`;
        elStatusDot.className = 'dot connected';
      }
    } else {
      currentDeviceId = null;
      if (elSelDeviceList) {
        elSelDeviceList.innerHTML = '<option value="">Chưa có thiết bị</option>';
      }
      elStatusDot.className = 'dot';
      elDeviceText.textContent = 'Chưa cắm điện thoại qua USB';
    }
  } catch (err) {
    updateFooterLog(`Lỗi kiểm tra thiết bị: ${err.message}`);
  }
}

if (elSelDeviceList) {
  elSelDeviceList.addEventListener('change', () => {
    currentDeviceId = elSelDeviceList.value;
    updateFooterLog(`Đã chuyển thiết bị mục tiêu sang: ${currentDeviceId}`);
    updateDeviceList();
  });
}

// Bắt đầu điều khiển với các cờ tối ưu hình ảnh & độ trễ
async function startCurrentControl() {
  if (!currentDeviceId) {
    const res = await window.api.getDevices();
    if (res.success && res.devices.length > 0) {
      const readyDev = res.devices.find(d => d.state === 'device') || res.devices[0];
      currentDeviceId = readyDev.id;
    }
  }

  if (!currentDeviceId) {
    alert('⚠️ Chưa phát hiện thấy điện thoại kết nối qua USB!\n\nCác bước kiểm tra nhanh:\n1. Kiểm tra dây cáp USB cắm chắc chắn giữa điện thoại và máy tính.\n2. Mở "Cài đặt" trên điện thoại -> "Tùy chọn nhà phát triển" -> Bật "Gỡ lỗi USB" (USB Debugging).\n3. Mở sáng màn hình điện thoại, nếu có thông báo "Cho phép gỡ lỗi USB?", hãy tích "Luôn cho phép từ máy tính này" và bấm "Cho phép".\n4. Bấm nút "Quét lại" trên phần mềm.');
    updateFooterLog('⚠️ Chưa tìm thấy thiết bị Android nào qua USB!');
    return;
  }

  const options = {
    deviceId: currentDeviceId,
    codec: elSelCodec.value,
    fps: parseInt(elSelFps.value) || 120,
    displayBuffer: parseInt(elSelDisplayBuffer.value) || 0,
    videoBuffer: parseInt(elSelDisplayBuffer.value) || 0,
    maxSize: parseInt(elSelMaxSize.value) || 1080,
    bitrate: elSelBitrate.value,
    renderDriver: elSelRenderDriver.value,
    mouseSpeed: elSelMouseSpeed ? elSelMouseSpeed.value : '0.35',
    mouseMode: elSelMouseMode ? elSelMouseMode.value : 'sdk',
    tabStyle: elSelTabStyle ? elSelTabStyle.value : 'pip',
    mirrorScreen: elChkMirrorScreen.checked,
    enableControl: elChkEnableControl ? elChkEnableControl.checked : true,
    uhidInput: elChkUhidInput ? elChkUhidInput.checked : true,
    turnScreenOff: elChkTurnScreenOff ? elChkTurnScreenOff.checked : false,
    forwardAudio: elChkForwardAudio.checked,
    stayAwake: elChkStayAwake.checked
  };

  updateFooterLog(`Đang kích hoạt [${activeProfile ? activeProfile.name : 'Game'}]: ${options.codec.toUpperCase()} | ${options.fps} FPS | Đệm: ${options.displayBuffer}ms...`);
  playSoundCue('activate');

  const res = await window.api.startControl(options);

  if (res.success) {
    setControllingState(true);
    updateFooterLog(res.message);
  } else {
    setControllingState(false);
    updateFooterLog(`Lỗi khởi chạy: ${res.message}`);
    alert(`Không thể khởi động điều khiển: ${res.message}\n\nHãy đảm bảo đã bật "Gỡ lỗi USB" trên điện thoại.`);
  }
}

async function handleToggleControl() {
  if (isControlling) {
    const res = await window.api.stopControl();
    if (res.success) {
      setControllingState(false);
      updateFooterLog('Đã dừng điều khiển.');
    }
  } else {
    await startCurrentControl();
  }
}

// 2 Nút Bắt Đầu Chiếu và Dừng Lại Tách Bạch
if (elBtnStartMirror) {
  elBtnStartMirror.addEventListener('click', async () => {
    await startCurrentControl();
  });
}

if (elBtnStopMirror) {
  elBtnStopMirror.addEventListener('click', async () => {
    await window.api.stopControl();
    setControllingState(false);
    updateFooterLog('Đã dừng chiếu màn hình và nhả chuột về máy tính.');
  });
}

// Thay đổi tức thì độ nhạy chuột ĐT (Không cần khởi động lại)
if (elSelMouseSpeed) {
  elSelMouseSpeed.addEventListener('change', async () => {
    const val = elSelMouseSpeed.value;
    if (window.api && window.api.setMouseSpeed) {
      await window.api.setMouseSpeed(val);
    }
    const label = elSelMouseSpeed.options[elSelMouseSpeed.selectedIndex] ? elSelMouseSpeed.options[elSelMouseSpeed.selectedIndex].text : val;
    updateFooterLog(`⚡ Đã cập nhật độ nhạy chuột ĐT: ${label}`);
  });
}

// Đồng bộ giữa checkbox Chiếu màn hình và Kiểu Tab
if (elSelTabStyle && elChkMirrorScreen) {
  elSelTabStyle.addEventListener('change', () => {
    if (elSelTabStyle.value === 'hidden') {
      elChkMirrorScreen.checked = false;
    } else {
      elChkMirrorScreen.checked = true;
    }
  });

  elChkMirrorScreen.addEventListener('change', () => {
    if (!elChkMirrorScreen.checked) {
      elSelTabStyle.value = 'hidden';
    } else if (elSelTabStyle.value === 'hidden') {
      elSelTabStyle.value = 'pip';
    }
  });
}

// ⭐ FORM THÊM GAME MỚI
if (elBtnToggleAddGame) {
  elBtnToggleAddGame.addEventListener('click', () => {
    const isHidden = elAddGameBox.style.display === 'none' || !elAddGameBox.style.display;
    elAddGameBox.style.display = isHidden ? 'flex' : 'none';
    if (isHidden && elTxtNewGameName) elTxtNewGameName.focus();
  });
}

if (elBtnCloseAddGame) {
  elBtnCloseAddGame.addEventListener('click', () => {
    elAddGameBox.style.display = 'none';
  });
}

if (elBtnConfirmAddGame) {
  elBtnConfirmAddGame.addEventListener('click', async () => {
    const name = elTxtNewGameName.value.trim();
    const icon = elTxtNewGameIcon.value.trim() || '🎮';
    const category = elSelNewGameCat.value;

    if (!name) {
      alert('Vui lòng nhập tên game mới.');
      elTxtNewGameName.focus();
      return;
    }

    const res = await window.api.addProfile({ name, icon, category });
    if (res.success && res.profile) {
      playSoundCue('activate');
      updateFooterLog(`Đã tạo thành công Profile Game: ${res.profile.name}!`);
      elTxtNewGameName.value = '';
      elTxtNewGameIcon.value = '';
      elAddGameBox.style.display = 'none';
      await loadProfiles();
      setActiveProfile(res.profile.id);
    }
  });
}

// ================= QUẢN LÝ PROFILES & GAME MODES =================
async function loadProfiles() {
  try {
    const data = await window.api.getProfiles();
    profilesData = data;
    renderGameSelector();
    setActiveProfile(data.activeProfileId || data.profiles[0].id);
    renderProfilesOverview();
  } catch (e) {
    console.error('Lỗi khi nạp profiles:', e);
  }
}

function renderGameSelector() {
  if (!profilesData || !profilesData.profiles) return;
  elGameSelectorGrid.innerHTML = '';

  profilesData.profiles.forEach(prof => {
    const card = document.createElement('div');
    card.className = `game-card ${prof.id === profilesData.activeProfileId ? 'active' : ''}`;
    card.setAttribute('data-id', prof.id);
    card.innerHTML = `
      <span class="game-card-icon">${prof.icon || '🎮'}</span>
      <span class="game-card-name">${prof.name}</span>
    `;
    card.addEventListener('click', () => {
      setActiveProfile(prof.id);
    });
    elGameSelectorGrid.appendChild(card);
  });
}

async function setActiveProfile(profileId) {
  if (!profilesData) return;
  const p = profilesData.profiles.find(x => x.id === profileId);
  if (!p) return;

  profilesData.activeProfileId = profileId;
  activeProfile = p;
  const modeIdx = p.activeModeIndex || 0;
  activeMode = (p.modes && p.modes[modeIdx]) ? p.modes[modeIdx] : p.modes[0];

  await window.api.setActiveProfile(profileId);

  // Cập nhật UI card
  document.querySelectorAll('.game-card').forEach(card => {
    if (card.getAttribute('data-id') === profileId) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  elLblProfileCategory.textContent = p.category || 'Game Tùy Chỉnh';
  updateModeDisplay();
}

function updateModeDisplay() {
  if (!activeMode) return;

  elLblModeIcon.textContent = activeProfile.icon || '⚡';
  elLblModeName.textContent = activeMode.name;
  elLblModeTag.textContent = activeMode.tag || 'Mặc Định';
  elLblModeDesc.textContent = activeMode.description || '';

  // Badges
  elBadgeFps.textContent = `${activeMode.fps || 60} FPS`;
  elBadgeCodec.textContent = (activeMode.codec || 'h264').toUpperCase();
  elBadgeBuffer.textContent = `Đệm: ${activeMode.displayBuffer !== undefined ? activeMode.displayBuffer : 0}ms`;
  elBadgeBitrate.textContent = activeMode.bitrate || '16M';
  elBadgeSize.textContent = activeMode.maxSize ? `${activeMode.maxSize}p` : 'Gốc';

  // Đồng bộ sang dropdown điều khiển
  if (activeMode.codec) elSelCodec.value = activeMode.codec;
  if (activeMode.fps) elSelFps.value = String(activeMode.fps);
  if (activeMode.displayBuffer !== undefined) elSelDisplayBuffer.value = String(activeMode.displayBuffer);
  if (activeMode.maxSize !== undefined) elSelMaxSize.value = String(activeMode.maxSize);
  if (activeMode.bitrate) elSelBitrate.value = activeMode.bitrate;
  if (activeMode.renderDriver) elSelRenderDriver.value = activeMode.renderDriver;
  if (elSelMouseSpeed && activeMode.mouseSpeed) elSelMouseSpeed.value = String(activeMode.mouseSpeed);

  if (activeMode.mirrorScreen !== undefined) elChkMirrorScreen.checked = activeMode.mirrorScreen;
  if (elChkEnableControl && activeMode.enableControl !== undefined) elChkEnableControl.checked = !!activeMode.enableControl;
  if (elChkUhidInput && activeMode.uhidInput !== undefined) elChkUhidInput.checked = activeMode.uhidInput !== false;
  if (elChkTurnScreenOff && activeMode.turnScreenOff !== undefined) elChkTurnScreenOff.checked = !!activeMode.turnScreenOff;
  if (activeMode.forwardAudio !== undefined) elChkForwardAudio.checked = activeMode.forwardAudio;
  if (activeMode.stayAwake !== undefined) elChkStayAwake.checked = activeMode.stayAwake;
}

// Nút mũi tên Trái / Phải
elBtnNextMode.addEventListener('click', async () => {
  const result = await window.api.nextMode();
  if (result && result.mode) {
    activeProfile = result.profile;
    activeMode = result.mode;
    playSoundCue('mode');
    updateModeDisplay();
    updateFooterLog(`🎮 [Nút ▶] Đã chuyển sang: ${result.mode.name}`);
    if (isControlling) startCurrentControl();
  }
});

elBtnPrevMode.addEventListener('click', async () => {
  const result = await window.api.prevMode();
  if (result && result.mode) {
    activeProfile = result.profile;
    activeMode = result.mode;
    playSoundCue('mode');
    updateModeDisplay();
    updateFooterLog(`🎮 [Nút ◀] Đã chuyển sang: ${result.mode.name}`);
    if (isControlling) startCurrentControl();
  }
});

// Lưu tùy chọn người dùng chỉnh thủ công vào active mode
function handleTuningChange() {
  if (!activeMode) return;
  const updatedOpts = {
    codec: elSelCodec.value,
    fps: parseInt(elSelFps.value) || 60,
    displayBuffer: parseInt(elSelDisplayBuffer.value) || 0,
    maxSize: parseInt(elSelMaxSize.value) || 0,
    bitrate: elSelBitrate.value,
    renderDriver: elSelRenderDriver.value,
    mouseSpeed: elSelMouseSpeed ? elSelMouseSpeed.value : '0.4',
    mirrorScreen: elChkMirrorScreen.checked,
    enableControl: elChkEnableControl ? elChkEnableControl.checked : true,
    uhidInput: elChkUhidInput ? elChkUhidInput.checked : true,
    turnScreenOff: elChkTurnScreenOff ? elChkTurnScreenOff.checked : false,
    forwardAudio: elChkForwardAudio.checked,
    stayAwake: elChkStayAwake.checked
  };

  Object.assign(activeMode, updatedOpts);
  updateModeDisplay();
  window.api.updateModeOptions(updatedOpts);
  updateFooterLog(`Đã cập nhật thông số cho chế độ: ${activeMode.name}`);
}

[elSelCodec, elSelFps, elSelDisplayBuffer, elSelMaxSize, elSelBitrate, elSelRenderDriver, elSelMouseSpeed, elChkMirrorScreen, elChkEnableControl, elChkUhidInput, elChkTurnScreenOff, elChkForwardAudio, elChkStayAwake].filter(Boolean).forEach(input => {
  input.addEventListener('change', () => {
    handleTuningChange();
    if (isControlling) {
      updateFooterLog('⚡ Đang áp dụng thiết lập tối ưu mới vào phiên điều khiển...');
      startCurrentControl();
    }
  });
});

// ================= GITHUB CLOUD SYNC =================
async function initGithubConfig() {
  const conf = await window.api.getGithubConfig();
  if (conf) {
    if (conf.token) elTxtGithubToken.value = conf.token;
    if (conf.gistId) elTxtGithubGistId.value = conf.gistId;
  }
}

elBtnToggleTokenVisibility.addEventListener('click', () => {
  elTxtGithubToken.type = elTxtGithubToken.type === 'password' ? 'text' : 'password';
});

elBtnSyncUpload.addEventListener('click', async () => {
  const token = elTxtGithubToken.value.trim();
  const gistId = elTxtGithubGistId.value.trim();

  if (!token) {
    alert('Vui lòng nhập GitHub Personal Access Token (PAT) có quyền "gist".');
    elTxtGithubToken.focus();
    return;
  }

  updateFooterLog('Đang đồng bộ profiles lên GitHub Gist Cloud...');
  elBtnSyncUpload.disabled = true;
  elBtnSyncUpload.textContent = '⏳ Đang tải lên...';

  try {
    const res = await window.api.syncGithubUpload({ token, gistId });
    if (res.success) {
      elTxtGithubGistId.value = res.gistId;
      updateFooterLog(res.message);
      alert(`ĐỒNG BỘ GITHUB THÀNH CÔNG!\n\n${res.message}\n\nMã Gist ID của bạn: ${res.gistId}\nBạn có thể dùng mã này trên máy tính khác để tải cấu hình về bất cứ lúc nào.`);
    } else {
      updateFooterLog(`Lỗi đồng bộ: ${res.message}`);
      alert(`Không thể đồng bộ lên GitHub: ${res.message}`);
    }
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    elBtnSyncUpload.disabled = false;
    elBtnSyncUpload.textContent = '⬆️ ĐẨY LÊN GITHUB (UPLOAD CLOUD)';
  }
});

elBtnSyncDownload.addEventListener('click', async () => {
  const gistId = elTxtGithubGistId.value.trim();
  const token = elTxtGithubToken.value.trim();

  if (!gistId) {
    alert('Vui lòng nhập Gist ID cần tải về.');
    elTxtGithubGistId.focus();
    return;
  }

  updateFooterLog(`Đang tải profiles từ GitHub Gist (${gistId})...`);
  elBtnSyncDownload.disabled = true;
  elBtnSyncDownload.textContent = '⏳ Đang tải về...';

  try {
    const res = await window.api.syncGithubDownload({ gistId, token });
    if (res.success) {
      updateFooterLog(res.message);
      await loadProfiles();
      alert(`TẢI VỀ THÀNH CÔNG!\n\n${res.message}\nĐã nạp toàn bộ profile game mới nhất.`);
    } else {
      updateFooterLog(`Lỗi tải về: ${res.message}`);
      alert(`Không thể tải về từ GitHub: ${res.message}`);
    }
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    elBtnSyncDownload.disabled = false;
    elBtnSyncDownload.textContent = '⬇️ TẢI VỀ TỪ GITHUB (DOWNLOAD CLOUD)';
  }
});

// JSON Backup
elBtnExportJson.addEventListener('click', async () => {
  const res = await window.api.exportProfiles();
  if (res.success) {
    elTxtImportJson.value = res.json;
    navigator.clipboard.writeText(res.json);
    updateFooterLog('Đã sao chép nội dung JSON profiles vào Clipboard!');
    alert('Đã sao chép toàn bộ dữ liệu cấu hình vào bộ nhớ tạm (Clipboard)!');
  }
});

elBtnSaveJsonFile.addEventListener('click', async () => {
  const res = await window.api.exportProfiles();
  if (res.success) {
    const blob = new Blob([res.json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pandakeyauto_profiles_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    updateFooterLog('Đã xuất tệp profiles.json về máy tính!');
  }
});

elBtnImportJson.addEventListener('click', async () => {
  const raw = elTxtImportJson.value.trim();
  if (!raw) {
    alert('Vui lòng dán nội dung JSON vào khung.');
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const res = await window.api.importProfiles(parsed);
    if (res.success) {
      await loadProfiles();
      alert('Đã khôi phục thành công danh sách Profiles từ JSON!');
      updateFooterLog('Đã khôi phục Profiles từ JSON!');
    } else {
      alert('Định dạng JSON không tương thích với ứng dụng.');
    }
  } catch (e) {
    alert('Dữ liệu không phải JSON hợp lệ: ' + e.message);
  }
});

function renderProfilesOverview() {
  if (!profilesData || !profilesData.profiles) return;
  elProfileListOverview.innerHTML = '';
  profilesData.profiles.forEach(p => {
    const item = document.createElement('div');
    item.className = 'profile-overview-item';
    const modeNames = p.modes.map(m => m.name).join(' • ');
    
    let deleteBtnHtml = '';
    if (profilesData.profiles.length > 1) {
      deleteBtnHtml = `<button class="btn-delete-game" data-id="${p.id}" title="Xóa profile game này">🗑️ Xóa</button>`;
    }

    item.innerHTML = `
      <div class="profile-overview-left">
        <div class="profile-overview-title">${p.icon} ${p.name} <span style="font-size:0.68rem; color:#60a5fa;">(${p.category})</span></div>
        <div class="profile-overview-modes">${p.modes.length} chế độ: ${modeNames}</div>
      </div>
      <div>
        ${deleteBtnHtml}
      </div>
    `;

    const delBtn = item.querySelector('.btn-delete-game');
    if (delBtn) {
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Bạn có chắc chắn muốn xóa profile "${p.name}"?`)) {
          const res = await window.api.deleteProfile(p.id);
          if (res.success) {
            updateFooterLog(`Đã xóa profile game: ${p.name}`);
            await loadProfiles();
          }
        }
      });
    }

    elProfileListOverview.appendChild(item);
  });
}

// ================= VIP TÂM NGẮM ẢO (CROSSHAIR HUD OVERLAY) =================
function renderCrosshairPreview() {
  const type = crosshairConfig.type || 'cross';
  const color = crosshairConfig.color || '#00ff66';
  const size = parseInt(crosshairConfig.size) || 30;
  const thickness = parseInt(crosshairConfig.thickness) || 2;
  const gap = parseInt(crosshairConfig.gap) || 5;

  elPreviewCrosshairSvg.setAttribute('width', size * 2);
  elPreviewCrosshairSvg.setAttribute('height', size * 2);
  elPreviewCrosshairSvg.setAttribute('viewBox', `0 0 ${size * 2} ${size * 2}`);

  const center = size;
  let innerHTML = '';

  if (type === 'dot') {
    innerHTML = `<circle cx="${center}" cy="${center}" r="${thickness + 1}" fill="${color}" stroke="#000" stroke-width="0.8" />`;
  } else if (type === 'circle-dot') {
    const r = gap + 6;
    innerHTML = `
      <circle cx="${center}" cy="${center}" r="${r}" fill="none" stroke="${color}" stroke-width="${thickness}" stroke-dasharray="8 3" opacity="0.85" />
      <circle cx="${center}" cy="${center}" r="${thickness}" fill="${color}" stroke="#000" stroke-width="0.6" />
    `;
  } else if (type === 't-cross') {
    innerHTML = `
      <line x1="${center - gap - 8}" y1="${center}" x2="${center - gap}" y2="${center}" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round" />
      <line x1="${center + gap}" y1="${center}" x2="${center + gap + 8}" y2="${center}" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round" />
      <line x1="${center}" y1="${center + gap}" x2="${center}" y2="${center + gap + 8}" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round" />
      <circle cx="${center}" cy="${center}" r="1.5" fill="${color}" />
    `;
  } else {
    innerHTML = `
      <line x1="${center}" y1="${center - gap - 8}" x2="${center}" y2="${center - gap}" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round" />
      <line x1="${center}" y1="${center + gap}" x2="${center}" y2="${center + gap + 8}" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round" />
      <line x1="${center - gap - 8}" y1="${center}" x2="${center - gap}" y2="${center}" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round" />
      <line x1="${center + gap}" y1="${center}" x2="${center + gap + 8}" y2="${center}" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round" />
      <circle cx="${center}" cy="${center}" r="1.2" fill="${color}" />
    `;
  }

  elPreviewCrosshairSvg.innerHTML = innerHTML;
}

elBtnToggleCrosshair.addEventListener('click', async () => {
  crosshairConfig.enabled = !crosshairConfig.enabled;
  const res = await window.api.toggleCrosshair(crosshairConfig.enabled);
  if (res.success) {
    if (res.enabled) {
      elBtnToggleCrosshair.classList.add('active');
      elBtnToggleCrosshair.textContent = '❌ TẮT TÂM NGẮM ẢO';
      elCrosshairStatusText.textContent = '🟢 Đang hiển thị đè lên game (chuột bấm xuyên qua)';
      updateFooterLog('🎯 Đã BẬT tâm ngắm ảo VIP chính giữa màn hình!');
    } else {
      elBtnToggleCrosshair.classList.remove('active');
      elBtnToggleCrosshair.textContent = '🎯 BẬT TÂM NGẮM ẢO TRÊN MÀN HÌNH';
      elCrosshairStatusText.textContent = 'Đang tắt';
      updateFooterLog('Đã tắt tâm ngắm ảo.');
    }
  }
});

document.querySelectorAll('.btn-type-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-type-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    crosshairConfig.type = btn.getAttribute('data-type');
    renderCrosshairPreview();
    if (crosshairConfig.enabled) window.api.updateCrosshair(crosshairConfig);
  });
});

document.querySelectorAll('.color-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
    crosshairConfig.color = dot.getAttribute('data-color');
    renderCrosshairPreview();
    if (crosshairConfig.enabled) window.api.updateCrosshair(crosshairConfig);
  });
});

elRngCrosshairSize.addEventListener('input', (e) => {
  crosshairConfig.size = parseInt(e.target.value);
  elLblCrosshairSize.textContent = `${crosshairConfig.size}px`;
  renderCrosshairPreview();
  if (crosshairConfig.enabled) window.api.updateCrosshair(crosshairConfig);
});

elRngCrosshairGap.addEventListener('input', (e) => {
  crosshairConfig.gap = parseInt(e.target.value);
  elLblCrosshairGap.textContent = `${crosshairConfig.gap}px`;
  renderCrosshairPreview();
  if (crosshairConfig.enabled) window.api.updateCrosshair(crosshairConfig);
});

// ================= VIP TẢN NHIỆT ĐIỆN THOẠI =================
elBtnToggleCooler.addEventListener('click', async () => {
  isCoolerActive = !isCoolerActive;
  const res = await window.api.togglePhoneCooler({ deviceId: currentDeviceId, enable: isCoolerActive });
  if (res.success) {
    if (res.coolerActive) {
      elBtnToggleCooler.classList.add('active');
      elBtnToggleCooler.textContent = '☀️ TẮT TẢN NHIỆT (KHÔI PHỤC ĐỘ SÁNG)';
      elCoolerStatusBadge.textContent = '❄️ Màn hình ĐT đã hạ tối đa - Máy đang mát lạnh';
      updateFooterLog(res.message);
    } else {
      elBtnToggleCooler.classList.remove('active');
      elBtnToggleCooler.textContent = '❄️ BẬT TẢN NHIỆT (HẠ ĐỘ SÁNG MÀN ĐT VỀ 0)';
      elCoolerStatusBadge.textContent = 'Đang bình thường';
      updateFooterLog(res.message);
    }
  }
});

// ================= 🚀 VIP: GAME BOOSTER 1-CLICK =================
if (elBtnBoostDevice) {
  elBtnBoostDevice.addEventListener('click', async () => {
    updateFooterLog('Đang kích hoạt Game Booster via ADB...');
    playSoundCue('activate');
    const res = await window.api.boostDevice({ deviceId: currentDeviceId });
    updateFooterLog(res.message);
    alert(res.message);
  });
}

if (elBtnRestoreAnim) {
  elBtnRestoreAnim.addEventListener('click', async () => {
    updateFooterLog('Đang khôi phục hiệu ứng chuyển động Android...');
    const res = await window.api.restoreDeviceAnim({ deviceId: currentDeviceId });
    updateFooterLog(res.message);
    alert(res.message);
  });
}

// ================= 🔫 VIP: RAPID FIRE MACRO =================
if (elBtnToggleRapidFire) {
  elBtnToggleRapidFire.addEventListener('click', async () => {
    isRapidFireActive = !isRapidFireActive;
    const cps = elSelRapidCps ? parseInt(elSelRapidCps.value) : 16;
    const res = await window.api.toggleRapidFire({ enabled: isRapidFireActive, clicksPerSec: cps });
    if (res.enabled) {
      elBtnToggleRapidFire.classList.add('active');
      elBtnToggleRapidFire.textContent = '🛑 DỪNG RAPID FIRE MACRO';
      updateFooterLog(res.message);
    } else {
      elBtnToggleRapidFire.classList.remove('active');
      elBtnToggleRapidFire.textContent = '🔫 BẬT RAPID FIRE MACRO';
      updateFooterLog(res.message);
    }
  });
}

// ================= PANDA MOUSE PRO & UTILITIES =================
elBtnActivatePanda.addEventListener('click', async () => {
  updateFooterLog('Đang gửi lệnh kích hoạt Panda Mouse Pro...');
  playSoundCue('activate');
  const res = await window.api.activatePanda({ deviceId: currentDeviceId });
  updateFooterLog(res.message);
  alert(res.message);
});

elBtnSendText.addEventListener('click', async () => {
  const text = elTxtSendText.value;
  if (!text) return;
  const res = await window.api.sendTextToPhone({ deviceId: currentDeviceId, text });
  if (res.success) {
    updateFooterLog('Đã gửi văn bản vào điện thoại!');
    elTxtSendText.value = '';
  }
});

elBtnScreenshot.addEventListener('click', async () => {
  updateFooterLog('Đang chụp màn hình điện thoại...');
  const res = await window.api.takeScreenshot({ deviceId: currentDeviceId });
  updateFooterLog(res.message);
  alert(res.message);
});

elBtnOpenUrl.addEventListener('click', async () => {
  const url = elTxtUrl.value.trim();
  if (!url) return;
  const targetUrl = url.startsWith('http') ? url : `https://${url}`;
  const res = await window.api.openUrlOnPhone({ deviceId: currentDeviceId, url: targetUrl });
  updateFooterLog(res.message);
});

document.querySelectorAll('.btn-quick').forEach(btn => {
  btn.addEventListener('click', async () => {
    const keycode = btn.getAttribute('data-key');
    await window.api.sendKeyEvent({ deviceId: currentDeviceId, keycode });
    updateFooterLog(`Đã gửi mã phím Android: ${keycode}`);
  });
});

elBtnRestartAdb.addEventListener('click', async () => {
  updateFooterLog('Đang khởi động lại ADB Server...');
  const res = await window.api.restartAdb();
  updateFooterLog(res.message);
  updateDeviceList();
});

elBtnRefresh.addEventListener('click', () => {
  updateDeviceList();
  updateFooterLog('Đã quét lại danh sách cổng kết nối.');
});

// ================= KHỞI CHẠY LẦN ĐẦU =================
window.addEventListener('DOMContentLoaded', () => {
  loadProfiles();
  initGithubConfig();
  renderCrosshairPreview();
  updateDeviceList();
  setInterval(updateDeviceList, 3000);
});
