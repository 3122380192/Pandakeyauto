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

// Sub-Tabs trong Tab 1 (Chiến Game)
window.switchSubTab = function(targetId) {
  if (!targetId) return;
  const subBtns = document.querySelectorAll('.sub-tab-btn');
  const subPanes = document.querySelectorAll('.sub-tab-pane');
  subBtns.forEach(b => {
    if (b.getAttribute('data-subtab') === targetId) b.classList.add('active');
    else b.classList.remove('active');
  });
  subPanes.forEach(p => {
    if (p.id === targetId) p.classList.add('active');
    else p.classList.remove('active');
  });
  playSoundCue('mode');
  const tabNames = {
    'subtabTuning': '⚙️ 1. Thông Số & Chuột',
    'subtabControls': '🛡️ 2. Chế Độ & Tính Năng',
    'subtabCombatVip': '🎯 3. Chiến Thuật VIP (Ghìm Tâm, iPad 4:3, Macro)'
  };
  updateFooterLog(`Đã chuyển tab: ${tabNames[targetId] || targetId}`);
};

const subTabButtons = document.querySelectorAll('.sub-tab-btn');
subTabButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = btn.getAttribute('data-subtab');
    if (targetId && window.switchSubTab) {
      window.switchSubTab(targetId);
    }
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
const elRadModeBlackTab = document.getElementById('radModeBlackTab');
const elRadModeMirror = document.getElementById('radModeMirror');
const elLblModeBlackTab = document.getElementById('lblModeBlackTab');
const elLblModeMirror = document.getElementById('lblModeMirror');
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

// Switch Key, Full View & Auto-Reconnect Elements
const elSelSwitchKey = document.getElementById('selSwitchKey');
const elBadgeActiveSwitchKey = document.getElementById('badgeActiveSwitchKey');
const elKbdSwitchKeyTop = document.getElementById('kbdSwitchKeyTop');
const elChipSwitchKey = document.getElementById('chipSwitchKey');
const elChkFullView = document.getElementById('chkFullView');
const elSelFullViewMode = document.getElementById('selFullViewMode');
const elRowFullViewMode = document.getElementById('rowFullViewMode');
const elChkAutoReconnect = document.getElementById('chkAutoReconnect');

function updateFooterLog(msg) {
  const time = new Date().toLocaleTimeString();
  elFooterLog.textContent = `[${time}] ${msg}`;
}

// ================= IPC LISTENERS =================
window.api.onOtgLog((msg) => {
  updateFooterLog(msg.trim());
});

window.api.onOtgStatus((status) => {
  if (status.reconnecting) {
    updateFooterLog(`🔄 [Chống văng] Màn hình bị gián đoạn, đang tự động kết nối lại trong 1.5 giây...`);
    return;
  }
  if (!status.running) {
    setControllingState(false);
    if (status.code !== 0 && status.code !== null && status.code !== undefined) {
      updateFooterLog(`⚠️ Phiên điều khiển đã dừng (Mã: ${status.code})${status.error ? ': ' + status.error : ''}`);
      if (status.error && status.error.includes('unauthorized')) {
        alert('⚠️ Điện thoại chưa được cấp quyền!\n\nVui lòng mở khóa điện thoại và chọn "Cho phép gỡ lỗi USB" (Allow USB debugging).');
      } else if (status.error && (status.error.includes('offline') || status.error.includes('closed'))) {
        updateFooterLog('⚠️ Thiết bị bị ngắt kết nối. Vui lòng kiểm tra lại dây cáp USB!');
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
    
    // Đồng bộ tốc độ chuột tức thì mà KHÔNG restart làm văng màn hình game
    if (result.mode.mouseSpeed && window.api && window.api.setMouseSpeed) {
      window.api.setMouseSpeed(result.mode.mouseSpeed);
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

  const isMirror = elRadModeMirror && elRadModeMirror.checked;

  if (active) {
    elStatusDot.className = 'dot connected';
    if (elBtnStartMirror) elBtnStartMirror.classList.add('running');
    if (elBtnMirrorTitle) {
      elBtnMirrorTitle.textContent = isMirror
        ? `ĐANG CHIẾU [${activeProfile ? activeProfile.name : 'GAME'}] (BẤM ĐỂ NẠP LẠI)`
        : `ĐANG BẬT [TAB BẢNG ĐEN] (BẤM ĐỂ NẠP LẠI)`;
    }
    if (elBtnMirrorSub) elBtnMirrorSub.textContent = 'Phím tắt: Nhấn Alt để chuyển đổi Chuột & Bàn phím (Máy tính <> Điện thoại)';
    updateFooterLog(isMirror
      ? '🎮 ĐANG ĐIỀU KHIỂN & CHIẾU MÀN HÌNH! Nhấn Alt để chuyển đổi chuột & phím (cô lập với PC).'
      : '⬛ ĐANG BẬT TAB BẢNG ĐEN (TỐI ƯU TỐC ĐỘ CHUỘT NHẤT)! Nhấn Alt để chuyển đổi chuột & phím.');
  } else {
    if (elBtnStartMirror) elBtnStartMirror.classList.remove('running');
    updateModeCardVisuals();
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

  const isMirror = elRadModeBlackTab ? !elRadModeBlackTab.checked : true;
  const options = {
    deviceId: currentDeviceId,
    codec: elSelCodec.value || 'h264',
    fps: parseInt(elSelFps.value) || 60,
    displayBuffer: parseInt(elSelDisplayBuffer.value) || 10,
    videoBuffer: parseInt(elSelDisplayBuffer.value) || 10,
    maxSize: parseInt(elSelMaxSize.value) || 1080,
    bitrate: elSelBitrate.value,
    renderDriver: elSelRenderDriver.value,
    mouseSpeed: elSelMouseSpeed ? elSelMouseSpeed.value : 'native',
    mirrorScreen: isMirror,
    enableControl: elChkEnableControl ? elChkEnableControl.checked : true,
    uhidInput: elChkUhidInput ? elChkUhidInput.checked : true,
    turnScreenOff: elChkTurnScreenOff ? elChkTurnScreenOff.checked : false,
    forwardAudio: elChkForwardAudio ? elChkForwardAudio.checked : true,
    stayAwake: elChkStayAwake ? elChkStayAwake.checked : true,
    fullView: elChkFullView ? elChkFullView.checked : true,
    fullViewMode: elSelFullViewMode ? elSelFullViewMode.value : 'fullscreen',
    autoReconnect: elChkAutoReconnect ? elChkAutoReconnect.checked : true,
    recordGameplay: !!(document.getElementById('chkAutoRecord') && document.getElementById('chkAutoRecord').checked)
  };

  const modeDetailText = isMirror && options.fullView ? ` | Full View (${options.fullViewMode === 'borderless' ? 'Tràn viền' : 'Toàn màn hình'})` : '';
  updateFooterLog(`Đang kích hoạt [${activeProfile ? activeProfile.name : 'Game'}]: ${options.codec.toUpperCase()} | ${options.fps} FPS${modeDetailText}...`);
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

// ================= CÀI ĐẶT & ĐỒNG BỘ PHÍM CHUYỂN CHUỘT (PC ⇋ ĐIỆN THOẠI) =================
function formatSwitchKeyLabel(key) {
  const k = (key || 'alt').toLowerCase();
  switch (k) {
    case 'alt': return 'ALT';
    case 'tilde': return '~ (TILDE)';
    case 'capslock': return 'CAPS LOCK';
    case 'ctrl': return 'CTRL';
    case 'tab': return 'TAB';
    case 'f1': return 'F1';
    case 'f2': return 'F2';
    case 'f3': return 'F3';
    case 'f4': return 'F4';
    case 'mbutton': return 'CHUỘT GIỮA';
    case 'xbutton1': return 'CHUỘT HÔNG 4';
    case 'xbutton2': return 'CHUỘT HÔNG 5';
    default: return k.toUpperCase();
  }
}

function updateSwitchKeyDisplay(key) {
  const label = formatSwitchKeyLabel(key);
  if (elBadgeActiveSwitchKey) {
    elBadgeActiveSwitchKey.textContent = `Nút: ${label}`;
  }
  if (elKbdSwitchKeyTop) {
    elKbdSwitchKeyTop.textContent = label;
  }
  updateModeCardVisuals();
}

async function initSwitchKey() {
  let currentKey = 'alt';
  try {
    if (window.api && window.api.getSwitchKey) {
      currentKey = await window.api.getSwitchKey();
    } else {
      currentKey = localStorage.getItem('pandakey_switch_key') || 'alt';
    }
  } catch (e) {
    currentKey = localStorage.getItem('pandakey_switch_key') || 'alt';
  }

  if (elSelSwitchKey) {
    elSelSwitchKey.value = currentKey;
  }
  updateSwitchKeyDisplay(currentKey);
}

if (elSelSwitchKey) {
  elSelSwitchKey.addEventListener('change', async () => {
    const key = elSelSwitchKey.value;
    try {
      localStorage.setItem('pandakey_switch_key', key);
      if (window.api && window.api.setSwitchKey) {
        await window.api.setSwitchKey(key);
      }
      updateSwitchKeyDisplay(key);
      updateFooterLog(`⚡ Đã đổi nút chuyển chuột sang: [${formatSwitchKeyLabel(key)}] (Có hiệu lực ngay 0ms)`);
      playSoundCue('activate');
    } catch (e) {
      console.error(e);
    }
  });
}

if (elChipSwitchKey) {
  elChipSwitchKey.addEventListener('click', () => {
    if (typeof switchSubTab === 'function') {
      switchSubTab('subtabTuning');
    }
    if (elSelSwitchKey) {
      elSelSwitchKey.focus();
      elSelSwitchKey.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

if (elChkFullView && elRowFullViewMode) {
  elChkFullView.addEventListener('change', () => {
    elRowFullViewMode.style.display = elChkFullView.checked ? 'flex' : 'none';
  });
}

// Đồng bộ giao diện khi chuyển đổi giữa Tab Bảng Đen và Chiếu Màn Hình PC
function updateModeCardVisuals() {
  const isMirror = elRadModeMirror && elRadModeMirror.checked;
  if (elLblModeMirror) elLblModeMirror.classList.toggle('active', isMirror);
  if (elLblModeBlackTab) elLblModeBlackTab.classList.toggle('active', !isMirror);

  const activeKeyName = elSelSwitchKey ? formatSwitchKeyLabel(elSelSwitchKey.value) : 'ALT';

  if (!isControlling) {
    if (isMirror) {
      if (elBtnMirrorTitle) elBtnMirrorTitle.textContent = 'BẮT ĐẦU CHIẾU MÀN HÌNH';
      if (elBtnMirrorSub) elBtnMirrorSub.textContent = `Chiếu lên PC & Tương tác chuột phím (Phím tắt: Bấm ${activeKeyName} đổi chuột)`;
    } else {
      if (elBtnMirrorTitle) elBtnMirrorTitle.textContent = 'BẮT ĐẦU ĐIỀU KHIỂN (TAB BẢNG ĐEN)';
      if (elBtnMirrorSub) elBtnMirrorSub.textContent = `Mở tab bắt chuột tối ưu tốc độ • Bấm ${activeKeyName} đổi chuột tức thì 0ms`;
    }
  }
}

if (elRadModeBlackTab) {
  elRadModeBlackTab.addEventListener('change', updateModeCardVisuals);
}
if (elRadModeMirror) {
  elRadModeMirror.addEventListener('change', updateModeCardVisuals);
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

  if (activeMode.mirrorScreen !== undefined) {
    if (elRadModeMirror) elRadModeMirror.checked = !!activeMode.mirrorScreen;
    if (elRadModeBlackTab) elRadModeBlackTab.checked = !activeMode.mirrorScreen;
    if (typeof updateModeCardVisuals === 'function') updateModeCardVisuals();
  }
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
    mirrorScreen: elRadModeMirror ? elRadModeMirror.checked : false,
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

[elSelCodec, elSelFps, elSelDisplayBuffer, elSelMaxSize, elSelBitrate, elSelRenderDriver, elSelMouseSpeed, elRadModeMirror, elRadModeBlackTab, elChkEnableControl, elChkUhidInput, elChkTurnScreenOff, elChkForwardAudio, elChkStayAwake].filter(Boolean).forEach(input => {
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
  try {
    const conf = await window.api.getGithubConfig();
    if (conf) {
      if (conf.token) elTxtGithubToken.value = conf.token;
      if (conf.gistId) elTxtGithubGistId.value = conf.gistId;
    }
  } catch (e) {}
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

// Elements cho toggle switches VIP
const elBtnSwitchCrosshair = document.getElementById('btnSwitchCrosshair');
const elLblCrosshairState = document.getElementById('lblCrosshairState');
const elBtnSwitchCooler = document.getElementById('btnSwitchCooler');
const elLblCoolerState = document.getElementById('lblCoolerState');
const elBtnSwitchRapidFire = document.getElementById('btnSwitchRapidFire');
const elLblRapidState = document.getElementById('lblRapidState');

function updateCrosshairSwitchUI(enabled) {
  if (elBtnSwitchCrosshair) {
    if (enabled) elBtnSwitchCrosshair.classList.add('active');
    else elBtnSwitchCrosshair.classList.remove('active');
  }
  if (elLblCrosshairState) {
    elLblCrosshairState.textContent = enabled ? 'BẬT' : 'TẮT';
    if (enabled) elLblCrosshairState.classList.add('active');
    else elLblCrosshairState.classList.remove('active');
  }
}

function updateCoolerSwitchUI(active) {
  if (elBtnSwitchCooler) {
    if (active) elBtnSwitchCooler.classList.add('active');
    else elBtnSwitchCooler.classList.remove('active');
  }
  if (elLblCoolerState) {
    elLblCoolerState.textContent = active ? 'BẬT' : 'TẮT';
    if (active) elLblCoolerState.classList.add('active');
    else elLblCoolerState.classList.remove('active');
  }
}

function updateRapidSwitchUI(active) {
  if (elBtnSwitchRapidFire) {
    if (active) elBtnSwitchRapidFire.classList.add('active');
    else elBtnSwitchRapidFire.classList.remove('active');
  }
  if (elLblRapidState) {
    elLblRapidState.textContent = active ? 'BẬT' : 'TẮT';
    if (active) elLblRapidState.classList.add('active');
    else elLblRapidState.classList.remove('active');
  }
}

if (elBtnSwitchCrosshair) {
  elBtnSwitchCrosshair.addEventListener('click', () => {
    if (elBtnToggleCrosshair) elBtnToggleCrosshair.click();
  });
}

if (elBtnSwitchCooler) {
  elBtnSwitchCooler.addEventListener('click', () => {
    if (elBtnToggleCooler) elBtnToggleCooler.click();
  });
}

if (elBtnSwitchRapidFire) {
  elBtnSwitchRapidFire.addEventListener('click', () => {
    if (elBtnToggleRapidFire) elBtnToggleRapidFire.click();
  });
}

elBtnToggleCrosshair.addEventListener('click', async () => {
  crosshairConfig.enabled = !crosshairConfig.enabled;
  const res = await window.api.toggleCrosshair(crosshairConfig.enabled);
  if (res.success) {
    updateCrosshairSwitchUI(res.enabled);
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
    updateCoolerSwitchUI(res.coolerActive);
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
    updateRapidSwitchUI(res.enabled);
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

// ================= 🎯 RECOIL CONTROL (GHÌM TÂM TỰ ĐỘNG) =================
let isRecoilActive = false;
const elBtnToggleRecoil = document.getElementById('btnToggleRecoil');
const elLblRecoilState = document.getElementById('lblRecoilState');
const elBtnToggleRecoilQuick = document.getElementById('btnToggleRecoilQuick');
const elLblRecoilStateQuick = document.getElementById('lblRecoilStateQuick');
const elRngRecoilY = document.getElementById('rngRecoilY');
const elLblRecoilY = document.getElementById('lblRecoilY');
const elRngRecoilJitter = document.getElementById('rngRecoilJitter');
const elLblRecoilJitter = document.getElementById('lblRecoilJitter');
const elRngRecoilDelay = document.getElementById('rngRecoilDelay');
const elLblRecoilDelay = document.getElementById('lblRecoilDelay');

function updateRecoilUI() {
  if (elBtnToggleRecoil) {
    if (isRecoilActive) elBtnToggleRecoil.classList.add('active');
    else elBtnToggleRecoil.classList.remove('active');
  }
  if (elLblRecoilState) {
    elLblRecoilState.textContent = isRecoilActive ? 'BẬT' : 'TẮT';
    if (isRecoilActive) elLblRecoilState.classList.add('active');
    else elLblRecoilState.classList.remove('active');
  }
  if (elBtnToggleRecoilQuick) {
    if (isRecoilActive) elBtnToggleRecoilQuick.classList.add('active');
    else elBtnToggleRecoilQuick.classList.remove('active');
  }
  if (elLblRecoilStateQuick) {
    elLblRecoilStateQuick.textContent = isRecoilActive ? 'BẬT' : 'TẮT';
    if (isRecoilActive) elLblRecoilStateQuick.classList.add('active');
    else elLblRecoilStateQuick.classList.remove('active');
  }
}

async function handleToggleRecoil(forceState) {
  isRecoilActive = forceState !== undefined ? forceState : !isRecoilActive;
  updateRecoilUI();
  playSoundCue('activate');
  const pullY = parseInt(elRngRecoilY ? elRngRecoilY.value : 4) || 4;
  const jitterX = parseInt(elRngRecoilJitter ? elRngRecoilJitter.value : 1) || 1;
  const delayMs = parseInt(elRngRecoilDelay ? elRngRecoilDelay.value : 120) || 120;
  const res = await window.api.toggleRecoil({ enabled: isRecoilActive, pullY, jitterX, delayMs, intervalMs: 25 });
  updateFooterLog(res.message);
}

if (elBtnToggleRecoil) {
  elBtnToggleRecoil.addEventListener('click', () => handleToggleRecoil());
}

if (elLblRecoilState) {
  elLblRecoilState.style.cursor = 'pointer';
  elLblRecoilState.addEventListener('click', () => handleToggleRecoil());
}

if (elBtnToggleRecoilQuick) {
  elBtnToggleRecoilQuick.addEventListener('click', () => handleToggleRecoil());
}

if (elLblRecoilStateQuick) {
  elLblRecoilStateQuick.style.cursor = 'pointer';
  elLblRecoilStateQuick.addEventListener('click', () => handleToggleRecoil());
}

if (window.api && window.api.onRecoilToggled) {
  window.api.onRecoilToggled((active) => {
    isRecoilActive = !!active;
    updateRecoilUI();
  });
}

if (elRngRecoilY) {
  elRngRecoilY.addEventListener('input', () => {
    if (elLblRecoilY) elLblRecoilY.textContent = `${elRngRecoilY.value} px`;
    window.api.updateRecoilConfig({ pullY: parseInt(elRngRecoilY.value) });
  });
}

if (elRngRecoilJitter) {
  elRngRecoilJitter.addEventListener('input', () => {
    if (elLblRecoilJitter) elLblRecoilJitter.textContent = `±${elRngRecoilJitter.value} px`;
    window.api.updateRecoilConfig({ jitterX: parseInt(elRngRecoilJitter.value) });
  });
}

if (elRngRecoilDelay) {
  elRngRecoilDelay.addEventListener('input', () => {
    if (elLblRecoilDelay) elLblRecoilDelay.textContent = `${elRngRecoilDelay.value} ms`;
    window.api.updateRecoilConfig({ delayMs: parseInt(elRngRecoilDelay.value) });
  });
}

// Phím tắt F6 bật/tắt ghìm tâm siêu tốc
window.addEventListener('keydown', (e) => {
  if (e.key === 'F6') {
    e.preventDefault();
    handleToggleRecoil();
  }
});

// ================= 📱 KÉO GIÃN MÀN HÌNH TỈ LỆ IPAD (4:3) =================
const elSelIpadPreset = document.getElementById('selIpadPreset');
const elBoxIpadCustom = document.getElementById('boxIpadCustom');
const elTxtIpadWidth = document.getElementById('txtIpadWidth');
const elTxtIpadHeight = document.getElementById('txtIpadHeight');
const elTxtIpadDensity = document.getElementById('txtIpadDensity');
const elBtnApplyIpadView = document.getElementById('btnApplyIpadView');
const elBtnResetIpadView = document.getElementById('btnResetIpadView');
const elIpadViewStatus = document.getElementById('ipadViewStatus');
const elBtnToggleIpadSwitch = document.getElementById('btnToggleIpadSwitch');
const elLblIpadState = document.getElementById('lblIpadState');

let isIpadActive = false;

function updateIpadSwitchUI(active) {
  isIpadActive = active;
  if (elBtnToggleIpadSwitch) {
    if (active) elBtnToggleIpadSwitch.classList.add('active');
    else elBtnToggleIpadSwitch.classList.remove('active');
  }
  if (elLblIpadState) {
    elLblIpadState.textContent = active ? 'BẬT' : 'TẮT';
    if (active) elLblIpadState.classList.add('active');
    else elLblIpadState.classList.remove('active');
  }
}

if (elBtnToggleIpadSwitch) {
  elBtnToggleIpadSwitch.addEventListener('click', () => {
    if (!isIpadActive) {
      if (elBtnApplyIpadView) elBtnApplyIpadView.click();
    } else {
      if (elBtnResetIpadView) elBtnResetIpadView.click();
    }
  });
}

if (elLblIpadState) {
  elLblIpadState.style.cursor = 'pointer';
  elLblIpadState.addEventListener('click', () => {
    if (elBtnToggleIpadSwitch) elBtnToggleIpadSwitch.click();
  });
}

if (elSelIpadPreset) {
  elSelIpadPreset.addEventListener('change', () => {
    if (elSelIpadPreset.value === 'custom') {
      if (elBoxIpadCustom) elBoxIpadCustom.style.display = 'grid';
    } else {
      if (elBoxIpadCustom) elBoxIpadCustom.style.display = 'none';
    }
  });
}

if (elBtnApplyIpadView) {
  elBtnApplyIpadView.addEventListener('click', async () => {
    let width = 1440, height = 1920, density = 320;
    if (elSelIpadPreset.value === 'custom') {
      width = parseInt(elTxtIpadWidth.value) || 1440;
      height = parseInt(elTxtIpadHeight.value) || 1920;
      density = parseInt(elTxtIpadDensity.value) || 320;
    } else {
      const parts = elSelIpadPreset.value.split('x');
      width = parseInt(parts[0]) || 1440;
      height = parseInt(parts[1]) || 1920;
      density = (width >= 1536) ? 360 : 320;
    }
    updateFooterLog(`Đang chỉnh màn hình sang tỉ lệ iPad ${width}×${height}...`);
    const res = await window.api.setIpadView({ width, height, density, deviceId: currentDeviceId });
    updateFooterLog(res.message);
    if (res.success) {
      if (elIpadViewStatus) {
        elIpadViewStatus.textContent = `iPad (${width}×${height})`;
        elIpadViewStatus.classList.add('active');
      }
      updateIpadSwitchUI(true);
      playSoundCue('activate');
    } else {
      updateIpadSwitchUI(false);
      updateFooterLog('⚠️ Không thể chỉnh màn hình: Vui lòng kết nối cáp USB với điện thoại!');
    }
  });
}

if (elBtnResetIpadView) {
  elBtnResetIpadView.addEventListener('click', async () => {
    updateFooterLog('Đang khôi phục màn hình điện thoại về mặc định...');
    const res = await window.api.resetIpadView({ deviceId: currentDeviceId });
    updateFooterLog(res.message);
    if (elIpadViewStatus) {
      elIpadViewStatus.textContent = 'Tỉ lệ gốc';
      elIpadViewStatus.classList.remove('active');
    }
    updateIpadSwitchUI(false);
  });
}

// ================= 🔁 AUTO FARM / TOUCH MACRO RECORDER =================
const elBtnToggleRecordMacro = document.getElementById('btnToggleRecordMacro');
const elBtnPlayMacro = document.getElementById('btnPlayMacro');
const elSelMacroLoop = document.getElementById('selMacroLoop');
const elSelMacroSpeed = document.getElementById('selMacroSpeed');
const elMacroStatus = document.getElementById('macroStatus');
const elBtnToggleMacroPlay = document.getElementById('btnToggleMacroPlay');
const elLblMacroState = document.getElementById('lblMacroState');

let isRecordingMacro = false;
let isPlayingMacro = false;
let localMacroEvents = [];
let macroRecordStartTime = 0;

function updateMacroSwitchUI(active) {
  if (elBtnToggleMacroPlay) {
    if (active) elBtnToggleMacroPlay.classList.add('active');
    else elBtnToggleMacroPlay.classList.remove('active');
  }
  if (elLblMacroState) {
    elLblMacroState.textContent = active ? 'BẬT' : 'TẮT';
    if (active) elLblMacroState.classList.add('active');
    else elLblMacroState.classList.remove('active');
  }
}

if (elBtnToggleMacroPlay) {
  elBtnToggleMacroPlay.addEventListener('click', () => {
    if (elBtnPlayMacro) elBtnPlayMacro.click();
  });
}

if (elBtnToggleRecordMacro) {
  elBtnToggleRecordMacro.addEventListener('click', async () => {
    if (!isRecordingMacro) {
      isRecordingMacro = true;
      localMacroEvents = [];
      macroRecordStartTime = Date.now();
      elBtnToggleRecordMacro.classList.add('recording');
      elBtnToggleRecordMacro.textContent = '⏹ DỪNG GHI';
      if (elMacroStatus) {
        elMacroStatus.textContent = 'Đang ghi thao tác...';
        elMacroStatus.classList.add('active');
      }
      await window.api.startMacroRecord();
      updateFooterLog('🔴 Bắt đầu ghi thao tác chuột! Hãy click trên màn hình game.');
    } else {
      isRecordingMacro = false;
      elBtnToggleRecordMacro.classList.remove('recording');
      elBtnToggleRecordMacro.textContent = '🔴 Bắt Đầu Ghi';
      const res = await window.api.stopMacroRecord();
      const count = localMacroEvents.length;
      if (elMacroStatus) {
        elMacroStatus.textContent = count > 0 ? `Đã lưu ${count} thao tác` : 'Chưa có bản ghi';
        if (count === 0) elMacroStatus.classList.remove('active');
      }
      if (elBtnPlayMacro) elBtnPlayMacro.disabled = (count === 0);
      updateFooterLog(`⏹ Đã hoàn tất ghi! Tổng cộng: ${count} thao tác.`);
    }
  });
}

// Lắng nghe click trong cửa sổ khi đang ghi macro
window.addEventListener('mousedown', (e) => {
  if (isRecordingMacro) {
    const now = Date.now();
    const delay = localMacroEvents.length === 0 ? 100 : Math.min(3000, now - macroRecordStartTime);
    macroRecordStartTime = now;
    localMacroEvents.push({
      type: 'tap',
      x: e.clientX,
      y: e.clientY,
      delay: Math.max(50, delay)
    });
    if (elMacroStatus) {
      elMacroStatus.textContent = `Đang ghi: ${localMacroEvents.length} cú nhấp`;
    }
  }
});

if (elBtnPlayMacro) {
  elBtnPlayMacro.addEventListener('click', async () => {
    if (!isPlayingMacro) {
      if (localMacroEvents.length === 0) return alert('Chưa có thao tác nào được ghi!');
      isPlayingMacro = true;
      elBtnPlayMacro.textContent = '⏹ DỪNG PHÁT';
      updateMacroSwitchUI(true);
      const loopCount = parseInt(elSelMacroLoop ? elSelMacroLoop.value : 5) || 5;
      const speed = parseFloat(elSelMacroSpeed ? elSelMacroSpeed.value : 1.0) || 1.0;
      updateFooterLog(`▶ Đang tự động phát lại ${localMacroEvents.length} thao tác (Lặp: ${loopCount}, Tốc độ: ${speed}x)...`);
      const res = await window.api.playMacro({
        events: localMacroEvents,
        loopCount,
        speed,
        cooldownMs: 800,
        deviceId: currentDeviceId
      });
      updateFooterLog(res.message);
      isPlayingMacro = false;
      elBtnPlayMacro.textContent = '▶ Phát Lại';
      updateMacroSwitchUI(false);
    } else {
      isPlayingMacro = false;
      elBtnPlayMacro.textContent = '▶ Phát Lại';
      updateMacroSwitchUI(false);
      const res = await window.api.stopMacroPlay();
      updateFooterLog(res.message);
    }
  });
}

// ================= ⚡ HARDWARE & BATTERY HUD =================
const elBtnRefreshBattery = document.getElementById('btnRefreshBattery');
const elHudTemp = document.getElementById('hudTemp');
const elHudTempBadge = document.getElementById('hudTempBadge');
const elHudLevel = document.getElementById('hudLevel');
const elHudBatteryFill = document.getElementById('hudBatteryFill');
const elHudStatus = document.getElementById('hudStatus');
const elHudVoltage = document.getElementById('hudVoltage');
const elHudHealth = document.getElementById('hudHealth');
const elHudPowerSource = document.getElementById('hudPowerSource');
const elBtnToggleBypassCharging = document.getElementById('btnToggleBypassCharging');
const elBypassStatus = document.getElementById('bypassStatus');
const elBtnSet120Hz = document.getElementById('btnSet120Hz');
const elBtnSet90Hz = document.getElementById('btnSet90Hz');
const elReset60Hz = document.getElementById('btnReset60Hz');

let isBypassChargingActive = false;

async function refreshBatteryStats() {
  if (!currentDeviceId) return;
  try {
    const res = await window.api.getBatteryInfo({ deviceId: currentDeviceId });
    if (res.success && res.battery) {
      const b = res.battery;
      if (elHudLevel) elHudLevel.textContent = b.level;
      if (elHudBatteryFill) {
        elHudBatteryFill.style.width = `${b.level}%`;
        if (b.level <= 20) {
          elHudBatteryFill.style.background = 'linear-gradient(90deg, #ff3366, #f59e0b)';
        } else {
          elHudBatteryFill.style.background = 'linear-gradient(90deg, #00f2fe, #00f5d4)';
        }
      }
      if (elHudTemp) elHudTemp.textContent = b.tempC || '--';
      if (elHudTempBadge) {
        const temp = parseFloat(b.tempC) || 0;
        if (temp > 42) {
          elHudTempBadge.textContent = 'Quá Nhiệt (>42°C)';
          elHudTempBadge.className = 'metric-badge badge-hot';
        } else if (temp > 38) {
          elHudTempBadge.textContent = 'Hơi Ấm (38-42°C)';
          elHudTempBadge.className = 'metric-badge badge-warm';
        } else {
          elHudTempBadge.textContent = 'Mát Mẻ (<38°C)';
          elHudTempBadge.className = 'metric-badge badge-cool';
        }
      }
      if (elHudStatus) elHudStatus.textContent = b.status || 'Bình thường';
      if (elHudVoltage) elHudVoltage.textContent = `Điện áp: ${b.voltage} mV`;
      if (elHudHealth) elHudHealth.textContent = b.health || 'Tốt';
      if (elHudPowerSource) {
        elHudPowerSource.textContent = b.acPowered ? 'Nguồn: Củ sạc nhanh AC' : (b.usbPowered ? 'Nguồn: Cổng USB PC' : 'Nguồn: Đang dùng pin');
      }
    }
  } catch (e) {}
}

if (elBtnRefreshBattery) {
  elBtnRefreshBattery.addEventListener('click', () => {
    updateFooterLog('Đang làm mới thông số pin & nhiệt độ...');
    refreshBatteryStats();
  });
}

const elBtnSwitchBypass = document.getElementById('btnSwitchBypass');
const elLblBypassState = document.getElementById('lblBypassState');

function updateBypassSwitchUI(active) {
  if (elBtnSwitchBypass) {
    if (active) elBtnSwitchBypass.classList.add('active');
    else elBtnSwitchBypass.classList.remove('active');
  }
  if (elLblBypassState) {
    elLblBypassState.textContent = active ? 'BẬT' : 'TẮT';
    if (active) elLblBypassState.classList.add('active');
    else elLblBypassState.classList.remove('active');
  }
}

if (elBtnSwitchBypass) {
  elBtnSwitchBypass.addEventListener('click', () => {
    if (elBtnToggleBypassCharging) elBtnToggleBypassCharging.click();
  });
}

if (elBtnToggleBypassCharging) {
  elBtnToggleBypassCharging.addEventListener('click', async () => {
    isBypassChargingActive = !isBypassChargingActive;
    updateFooterLog('Đang chuyển đổi trạng thái Bypass Charging...');
    const res = await window.api.toggleBypassCharging({ enabled: isBypassChargingActive, deviceId: currentDeviceId });
    updateBypassSwitchUI(res.enabled);
    if (res.enabled) {
      elBtnToggleBypassCharging.textContent = '⚡ KHÔI PHỤC SẠC PIN';
      elBtnToggleBypassCharging.classList.add('active');
      if (elBypassStatus) {
        elBypassStatus.textContent = 'Bypass (Chống Nóng 100%)';
        elBypassStatus.classList.add('active');
      }
    } else {
      elBtnToggleBypassCharging.textContent = '❄️ BẬT BYPASS CHARGING';
      elBtnToggleBypassCharging.classList.remove('active');
      if (elBypassStatus) {
        elBypassStatus.textContent = 'Sạc bình thường';
        elBypassStatus.classList.remove('active');
      }
    }
    updateFooterLog(res.message);
    refreshBatteryStats();
  });
}

if (elBtnSet120Hz) {
  elBtnSet120Hz.addEventListener('click', async () => {
    updateFooterLog('Đang ép tần số quét 120Hz qua ADB...');
    const res = await window.api.setRefreshRate({ rate: 120, deviceId: currentDeviceId });
    updateFooterLog(res.message);
    alert(res.message);
  });
}

if (elBtnSet90Hz) {
  elBtnSet90Hz.addEventListener('click', async () => {
    updateFooterLog('Đang ép tần số quét 90Hz qua ADB...');
    const res = await window.api.setRefreshRate({ rate: 90, deviceId: currentDeviceId });
    updateFooterLog(res.message);
    alert(res.message);
  });
}

if (elReset60Hz) {
  elReset60Hz.addEventListener('click', async () => {
    updateFooterLog('Đang khôi phục tần số quét 60Hz...');
    const res = await window.api.setRefreshRate({ rate: 'reset', deviceId: currentDeviceId });
    updateFooterLog(res.message);
    alert(res.message);
  });
}

// ================= 📦 FILE DRAG & DROP & 1-CLICK WIRELESS ADB =================
const elApkDropzone = document.getElementById('apkDropzone');
const elFilePickerInput = document.getElementById('filePickerInput');
const elBtnBrowseFile = document.getElementById('btnBrowseFile');
const elDropzoneProgress = document.getElementById('dropzoneProgress');
const elDropzoneProgressFill = document.getElementById('dropzoneProgressFill');
const elDropzoneProgressText = document.getElementById('dropzoneProgressText');
const elBtnActivateWirelessAdb = document.getElementById('btnActivateWirelessAdb');
const elWirelessStatusBadge = document.getElementById('wirelessStatusBadge');

async function handleFileProcess(file) {
  if (!file || !file.path) return;
  if (!currentDeviceId) {
    return alert('Chưa có điện thoại nào kết nối! Hãy cắm cáp USB trước.');
  }

  const isApk = file.name.toLowerCase().endsWith('.apk');
  if (elDropzoneProgress) elDropzoneProgress.style.display = 'block';
  if (elDropzoneProgressFill) elDropzoneProgressFill.style.width = '30%';
  if (elDropzoneProgressText) elDropzoneProgressText.textContent = isApk ? `Đang cài đặt ${file.name}...` : `Đang chép ${file.name}...`;

  if (isApk) {
    updateFooterLog(`📦 Đang nạp và cài đặt file APK: ${file.name}...`);
    const res = await window.api.installApk({ filePath: file.path, deviceId: currentDeviceId });
    if (elDropzoneProgressFill) elDropzoneProgressFill.style.width = '100%';
    if (elDropzoneProgressText) elDropzoneProgressText.textContent = res.success ? 'Cài đặt thành công!' : 'Lỗi cài đặt!';
    updateFooterLog(res.message);
    setTimeout(() => { if (elDropzoneProgress) elDropzoneProgress.style.display = 'none'; }, 3000);
    alert(res.message);
  } else {
    updateFooterLog(`📁 Đang chép file vào /sdcard/Download/: ${file.name}...`);
    const res = await window.api.pushFileToPhone({ filePath: file.path, deviceId: currentDeviceId });
    if (elDropzoneProgressFill) elDropzoneProgressFill.style.width = '100%';
    if (elDropzoneProgressText) elDropzoneProgressText.textContent = res.success ? 'Chép file thành công!' : 'Lỗi chép file!';
    updateFooterLog(res.message);
    setTimeout(() => { if (elDropzoneProgress) elDropzoneProgress.style.display = 'none'; }, 3000);
    alert(res.message);
  }
}

if (elApkDropzone) {
  ['dragenter', 'dragover'].forEach(name => {
    elApkDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      elApkDropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    elApkDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      elApkDropzone.classList.remove('dragover');
    });
  });

  elApkDropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  });
}

if (elBtnBrowseFile && elFilePickerInput) {
  elBtnBrowseFile.addEventListener('click', () => elFilePickerInput.click());
  elFilePickerInput.addEventListener('change', () => {
    if (elFilePickerInput.files && elFilePickerInput.files.length > 0) {
      handleFileProcess(elFilePickerInput.files[0]);
    }
  });
}

if (elBtnActivateWirelessAdb) {
  elBtnActivateWirelessAdb.addEventListener('click', async () => {
    updateFooterLog('📡 Đang kích hoạt kết nối không dây qua cổng 5555...');
    elBtnActivateWirelessAdb.disabled = true;
    elBtnActivateWirelessAdb.textContent = '⏳ Đang dò IP và kết nối...';
    const res = await window.api.activateWirelessAdb({ deviceId: currentDeviceId });
    elBtnActivateWirelessAdb.disabled = false;
    elBtnActivateWirelessAdb.textContent = '📡 KÍCH HOẠT KHÔNG DÂY (RÚT CÁP)';
    if (res.success) {
      if (elWirelessStatusBadge) {
        elWirelessStatusBadge.textContent = `Không Dây (${res.ip}:5555)`;
        elWirelessStatusBadge.classList.add('active');
      }
      updateFooterLog(res.message);
      updateDeviceList();
      alert(`KẾT NỐI KHÔNG DÂY THÀNH CÔNG!\n\n${res.message}\n\nBạn có thể rút dây cáp USB ngay bây giờ mà vẫn tiếp tục chơi game và chiếu màn hình.`);
    } else {
      updateFooterLog(res.message);
      alert(res.message);
    }
  });
}

// ================= 🎥 STREAMER & CONTENT CREATOR =================
const elBtnOpenRecordings = document.getElementById('btnOpenRecordings');
const elBtnToggleShowTouches = document.getElementById('btnToggleShowTouches');
const elTouchesStatusBadge = document.getElementById('touchesStatusBadge');

let isShowTouchesActive = false;

if (elBtnOpenRecordings) {
  elBtnOpenRecordings.addEventListener('click', async () => {
    await window.api.openRecordingsFolder();
    updateFooterLog('Đã mở thư mục Recordings chứa video đã quay.');
  });
}

const elBtnSwitchTouches = document.getElementById('btnSwitchTouches');
const elLblTouchesState = document.getElementById('lblTouchesState');

function updateTouchesSwitchUI(active) {
  if (elBtnSwitchTouches) {
    if (active) elBtnSwitchTouches.classList.add('active');
    else elBtnSwitchTouches.classList.remove('active');
  }
  if (elLblTouchesState) {
    elLblTouchesState.textContent = active ? 'BẬT' : 'TẮT';
    if (active) elLblTouchesState.classList.add('active');
    else elLblTouchesState.classList.remove('active');
  }
}

if (elBtnSwitchTouches) {
  elBtnSwitchTouches.addEventListener('click', () => {
    if (elBtnToggleShowTouches) elBtnToggleShowTouches.click();
  });
}

if (elBtnToggleShowTouches) {
  elBtnToggleShowTouches.addEventListener('click', async () => {
    isShowTouchesActive = !isShowTouchesActive;
    updateFooterLog('Đang thay đổi cài đặt hiển thị chạm tay...');
    const res = await window.api.toggleShowTouches({ enabled: isShowTouchesActive, deviceId: currentDeviceId });
    updateTouchesSwitchUI(res.enabled);
    if (res.enabled) {
      elBtnToggleShowTouches.textContent = '⚪ TẮT HIỂN THỊ CHẠM';
      if (elTouchesStatusBadge) {
        elTouchesStatusBadge.textContent = 'Đang hiển thị';
        elTouchesStatusBadge.classList.add('active');
      }
    } else {
      elBtnToggleShowTouches.textContent = '⚪ BẬT HIỂN THỊ CHẠM TAY';
      if (elTouchesStatusBadge) {
        elTouchesStatusBadge.textContent = 'Đang tắt';
        elTouchesStatusBadge.classList.remove('active');
      }
    }
    updateFooterLog(res.message);
  });
}

// ================= 🎨 COMBAT ASSIST: COLOR AIM & ENEMY HIGHLIGHTER =================
const elBtnToggleColorAssist = document.getElementById('btnToggleColorAssist');
const elBtnSwitchColorAssist = document.getElementById('btnSwitchColorAssist');
const elLblColorAssistState = document.getElementById('lblColorAssistState');
const elColorAssistStatus = document.getElementById('colorAssistStatus');
const elRngFovSize = document.getElementById('rngFovSize');
const elLblFovSize = document.getElementById('lblFovSize');
const elRngSmoothSpeed = document.getElementById('rngSmoothSpeed');
const elLblSmoothSpeed = document.getElementById('lblSmoothSpeed');
const elSelEnemyFilter = document.getElementById('selEnemyFilter');
const elChkTriggerBot = document.getElementById('chkTriggerBot');

let isColorAssistActive = false;
let colorAssistSettings = {
  enabled: false,
  color: 'red',
  fovSize: 80,
  smoothSpeed: 5,
  triggerBot: false,
  filterMode: 'vibrance'
};

function updateColorAssistSwitchUI(active) {
  if (elBtnSwitchColorAssist) {
    if (active) elBtnSwitchColorAssist.classList.add('active');
    else elBtnSwitchColorAssist.classList.remove('active');
  }
  if (elLblColorAssistState) {
    elLblColorAssistState.textContent = active ? 'BẬT' : 'TẮT';
    if (active) elLblColorAssistState.classList.add('active');
    else elLblColorAssistState.classList.remove('active');
  }
}

if (elBtnSwitchColorAssist) {
  elBtnSwitchColorAssist.addEventListener('click', () => {
    if (elBtnToggleColorAssist) elBtnToggleColorAssist.click();
  });
}

if (elBtnToggleColorAssist) {
  elBtnToggleColorAssist.addEventListener('click', async () => {
    isColorAssistActive = !isColorAssistActive;
    colorAssistSettings.enabled = isColorAssistActive;
    updateColorAssistSwitchUI(isColorAssistActive);
    if (isColorAssistActive) {
      elBtnToggleColorAssist.textContent = '🛑 DỪNG COLOR AIM ASSIST';
      elBtnToggleColorAssist.classList.add('active');
      if (elColorAssistStatus) {
        elColorAssistStatus.textContent = `Đang bám mục tiêu: ${colorAssistSettings.color.toUpperCase()}`;
        elColorAssistStatus.classList.add('active');
      }
    } else {
      elBtnToggleColorAssist.textContent = '🎯 BẬT COLOR AIM ASSIST';
      elBtnToggleColorAssist.classList.remove('active');
      if (elColorAssistStatus) {
        elColorAssistStatus.textContent = 'Đang tắt';
        elColorAssistStatus.classList.remove('active');
      }
    }
    const res = await window.api.toggleColorAssist({ enabled: isColorAssistActive });
    updateFooterLog(`🎯 Color Aim Assist: ${isColorAssistActive ? 'ĐÃ KÍCH HOẠT' : 'ĐÃ TẮT'}`);
  });
}

document.querySelectorAll('.btn-color-tag').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-color-tag').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    colorAssistSettings.color = btn.getAttribute('data-color') || 'red';
    window.api.updateColorAssistConfig({ color: colorAssistSettings.color });
    updateFooterLog(`Đã đổi màu nhận diện mục tiêu sang: ${colorAssistSettings.color.toUpperCase()}`);
  });
});

if (elRngFovSize) {
  elRngFovSize.addEventListener('input', () => {
    if (elLblFovSize) elLblFovSize.textContent = `${elRngFovSize.value} px`;
    colorAssistSettings.fovSize = parseInt(elRngFovSize.value);
    window.api.updateColorAssistConfig({ fovSize: colorAssistSettings.fovSize });
  });
}

if (elRngSmoothSpeed) {
  elRngSmoothSpeed.addEventListener('input', () => {
    if (elLblSmoothSpeed) elLblSmoothSpeed.textContent = elRngSmoothSpeed.value;
    colorAssistSettings.smoothSpeed = parseInt(elRngSmoothSpeed.value);
    window.api.updateColorAssistConfig({ smoothSpeed: colorAssistSettings.smoothSpeed });
  });
}

if (elChkTriggerBot) {
  elChkTriggerBot.addEventListener('change', () => {
    colorAssistSettings.triggerBot = elChkTriggerBot.checked;
    window.api.updateColorAssistConfig({ triggerBot: elChkTriggerBot.checked });
    updateFooterLog(`Triggerbot tự động bắn: ${elChkTriggerBot.checked ? 'BẬT' : 'TẮT'}`);
  });
}

if (elSelEnemyFilter) {
  elSelEnemyFilter.addEventListener('change', () => {
    colorAssistSettings.filterMode = elSelEnemyFilter.value;
    window.api.updateColorAssistConfig({ filterMode: elSelEnemyFilter.value });
    updateFooterLog(`Đã áp dụng bộ lọc màu hiển thị: ${elSelEnemyFilter.options[elSelEnemyFilter.selectedIndex].text}`);
  });
}

// ================= KHỞI CHẠY LẦN ĐẦU =================
window.addEventListener('DOMContentLoaded', () => {
  loadProfiles();
  initSwitchKey();
  initGithubConfig();
  renderCrosshairPreview();
  updateModeCardVisuals();
  updateDeviceList();
  refreshBatteryStats();
  setInterval(updateDeviceList, 3000);
  setInterval(refreshBatteryStats, 4000);
});
