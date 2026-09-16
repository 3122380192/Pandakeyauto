const fs = require('fs');
const path = require('path');

const DEFAULT_PROFILES = [
  {
    id: 'freefire',
    name: 'Free Fire',
    icon: '🔥',
    category: 'FPS / Battle Royale',
    activeModeIndex: 0,
    modes: [
      {
        id: 'ff-extreme',
        name: 'Sinh Tồn 120 FPS (Độ Trễ 0ms)',
        tag: 'Thi Đấu',
        fps: 120,
        bitrate: '16M',
        maxSize: 1080,
        codec: 'h265',
        displayBuffer: 0,
        audioBuffer: 10,
        stayAwake: true,
        turnScreenOff: false,
        forwardAudio: true,
        mirrorScreen: true,
        renderDriver: 'direct3d11',
        description: 'Tối ưu tối đa tốc độ phản xạ và ghìm tâm súng, loại bỏ hoàn toàn đệm hình ảnh.'
      },
      {
        id: 'ff-balanced',
        name: 'Tử Chiến Rank Cân Bằng (90 FPS)',
        tag: 'Cân Bằng',
        fps: 90,
        bitrate: '12M',
        maxSize: 1080,
        codec: 'h264',
        displayBuffer: 10,
        audioBuffer: 20,
        stayAwake: true,
        turnScreenOff: false,
        forwardAudio: true,
        mirrorScreen: true,
        renderDriver: 'direct3d11',
        description: 'Cân bằng hình ảnh sắc nét và độ mượt, chống rách hình khi xoay camera nhanh.'
      },
      {
        id: 'ff-otg-direct',
        name: 'Chuột Bàn Phím Trực Tiếp (Màn Thật ĐT)',
        tag: '0ms Lag',
        fps: 60,
        bitrate: '8M',
        maxSize: 0,
        codec: 'h264',
        displayBuffer: 0,
        audioBuffer: 20,
        stayAwake: true,
        turnScreenOff: false,
        forwardAudio: false,
        mirrorScreen: false,
        renderDriver: 'direct3d11',
        description: 'Không chiếu màn hình PC, điều khiển thẳng trên màn điện thoại tiết kiệm tài nguyên.'
      }
    ]
  },
  {
    id: 'deltaforce',
    name: 'Delta Force',
    icon: '🎖️',
    category: 'Chiến Thuật Quân Sự / FPS',
    activeModeIndex: 0,
    modes: [
      {
        id: 'df-tactical',
        name: 'Chiến Trường Tác Chiến (120 FPS, 0ms Delay)',
        tag: 'Thi Đấu 0ms',
        fps: 120,
        bitrate: '20M',
        maxSize: 1080,
        codec: 'h265',
        displayBuffer: 0,
        audioBuffer: 10,
        stayAwake: true,
        turnScreenOff: false,
        forwardAudio: true,
        mirrorScreen: true,
        renderDriver: 'direct3d11',
        description: 'Tối ưu tối đa độ trễ phản xạ ngắm bắn và sấy đạn trong các trận chiến khốc liệt quy mô lớn.'
      },
      {
        id: 'df-recon',
        name: 'Đột Kích Trinh Sát & Bắn Tỉa 2K (Siêu Nét)',
        tag: 'Đồ Họa 2K',
        fps: 90,
        bitrate: '28M',
        maxSize: 1440,
        codec: 'h265',
        displayBuffer: 10,
        audioBuffer: 15,
        stayAwake: true,
        turnScreenOff: false,
        forwardAudio: true,
        mirrorScreen: true,
        renderDriver: 'direct3d11',
        description: 'Độ phân giải 2K sắc nét vượt trội giúp phát hiện mục tiêu ẩn nấp từ cự ly siêu xa.'
      },
      {
        id: 'df-balanced',
        name: 'Chiến Trận Cân Bằng (90 FPS Mượt Mà)',
        tag: 'Cân Bằng',
        fps: 90,
        bitrate: '14M',
        maxSize: 1080,
        codec: 'h264',
        displayBuffer: 10,
        audioBuffer: 20,
        stayAwake: true,
        turnScreenOff: false,
        forwardAudio: true,
        mirrorScreen: true,
        renderDriver: 'direct3d11',
        description: 'Mượt mà ổn định, chống nóng máy và tụt khung hình khi giao tranh dài.'
      }
    ]
  },
  {
    id: 'pubg',
    name: 'PUBG Mobile / COD',
    icon: '🎯',
    category: 'FPS / Battle Royale',
    activeModeIndex: 0,
    modes: [
      {
        id: 'pubg-sniper',
        name: 'Bắn Tỉa & Sấy Đạn Nét Căng 2K/1080p',
        tag: 'Đồ Họa Cao',
        fps: 90,
        bitrate: '24M',
        maxSize: 1440,
        codec: 'h265',
        displayBuffer: 10,
        audioBuffer: 15,
        stayAwake: true,
        turnScreenOff: false,
        forwardAudio: true,
        mirrorScreen: true,
        renderDriver: 'direct3d11',
        description: 'Tăng cường chi tiết tầm nhìn xa để phát hiện kẻ địch núp bụi và ngắm bắn chuẩn xác.'
      },
      {
        id: 'pubg-comp',
        name: 'Esport Thi Đấu Phản Xạ 120 FPS',
        tag: 'Tốc Độ Cao',
        fps: 120,
        bitrate: '16M',
        maxSize: 1080,
        codec: 'h265',
        displayBuffer: 0,
        audioBuffer: 10,
        stayAwake: true,
        turnScreenOff: false,
        forwardAudio: true,
        mirrorScreen: true,
        renderDriver: 'direct3d11',
        description: 'Khử độ trễ đầu vào bàn phím và chuột, tốc độ khung hình cao nhất cho combat liên tục.'
      }
    ]
  },
  {
    id: 'aov',
    name: 'Liên Quân Mobile / Tốc Chiến',
    icon: '⚔️',
    category: 'MOBA',
    activeModeIndex: 0,
    modes: [
      {
        id: 'aov-combat',
        name: 'Combat Tổng Siêu Mượt (60-90 FPS)',
        tag: 'MOBA Chuẩn',
        fps: 90,
        bitrate: '16M',
        maxSize: 1080,
        codec: 'h264',
        displayBuffer: 15,
        audioBuffer: 20,
        stayAwake: true,
        turnScreenOff: false,
        forwardAudio: true,
        mirrorScreen: true,
        renderDriver: 'direct3d11',
        description: 'Định hướng chiêu thức mượt mà, tối ưu màu sắc hiển thị chiêu và thanh máu đối thủ.'
      },
      {
        id: 'aov-eco',
        name: 'Tiết Kiệm Pin & Mát Máy ĐT',
        tag: 'Mát Máy',
        fps: 60,
        bitrate: '10M',
        maxSize: 720,
        codec: 'h264',
        displayBuffer: 10,
        audioBuffer: 20,
        stayAwake: true,
        turnScreenOff: false,
        enableControl: true,
        uhidInput: true,
        forwardAudio: true,
        mirrorScreen: true,
        renderDriver: 'direct3d11',
        description: 'Tối ưu tài nguyên giúp máy mát lạnh, duy trì fps ổn định khi combat.'
      }
    ]
  },
  {
    id: 'genshin',
    name: 'Genshin Impact / Star Rail',
    icon: '✨',
    category: 'Open World RPG',
    activeModeIndex: 0,
    modes: [
      {
        id: 'genshin-cinema',
        name: 'Đồ Họa Điện Ảnh Siêu Nét (H.265 2K)',
        tag: 'Cinematic',
        fps: 60,
        bitrate: '28M',
        maxSize: 1440,
        codec: 'h265',
        displayBuffer: 25,
        audioBuffer: 25,
        stayAwake: true,
        turnScreenOff: false,
        enableControl: true,
        uhidInput: true,
        forwardAudio: true,
        mirrorScreen: true,
        renderDriver: 'direct3d11',
        description: 'Tối đa chất lượng hình ảnh thế giới mở, màu sắc rực rỡ và âm thanh vòm chất lượng cao.'
      },
      {
        id: 'genshin-auto',
        name: 'Treo Máy Cày Cuốc 24/7 (30 FPS Mát Máy)',
        tag: 'Treo Game',
        fps: 30,
        bitrate: '6M',
        maxSize: 720,
        codec: 'h264',
        displayBuffer: 0,
        audioBuffer: 50,
        stayAwake: true,
        turnScreenOff: false,
        enableControl: true,
        uhidInput: true,
        forwardAudio: false,
        mirrorScreen: true,
        renderDriver: 'direct3d11',
        description: 'Giảm tải CPU và GPU, giảm fps để máy mát lạnh cả ngày.'
      }
    ]
  },
  {
    id: 'custom',
    name: 'Cấu Hình Tùy Biến',
    icon: '🛠️',
    category: 'Tùy Chỉnh',
    activeModeIndex: 0,
    modes: [
      {
        id: 'custom-user',
        name: 'Chế Độ Người Dùng Tự Thiết Lập',
        tag: 'Tùy Chỉnh',
        fps: 60,
        bitrate: '16M',
        maxSize: 1080,
        codec: 'h264',
        displayBuffer: 0,
        audioBuffer: 20,
        stayAwake: true,
        turnScreenOff: false,
        forwardAudio: true,
        mirrorScreen: true,
        renderDriver: 'direct3d11',
        description: 'Tự do tùy chỉnh codec, bitrate, fps và buffer phù hợp với cấu hình thiết bị của bạn.'
      }
    ]
  }
];

class ProfileManager {
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'profiles.json');
    this.activeProfileId = 'freefire';
    this.profiles = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
          this.profiles = parsed.profiles;
          this.activeProfileId = parsed.activeProfileId || this.profiles[0].id;

          // Đảm bảo Delta Force luôn được bổ sung nếu chưa có
          if (!this.profiles.some(p => p.id === 'deltaforce')) {
            const dfPreset = DEFAULT_PROFILES.find(p => p.id === 'deltaforce');
            if (dfPreset) {
              this.profiles.splice(1, 0, JSON.parse(JSON.stringify(dfPreset)));
              this.save();
            }
          }
          return;
        }
      }
    } catch (e) {
      console.error('Lỗi khi đọc file profiles:', e);
    }
    this.profiles = JSON.parse(JSON.stringify(DEFAULT_PROFILES));
    this.activeProfileId = 'freefire';
    this.save();
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        activeProfileId: this.activeProfileId,
        lastUpdated: new Date().toISOString(),
        profiles: this.profiles
      };
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('Lỗi khi ghi file profiles:', e);
      return false;
    }
  }

  getAll() {
    return {
      activeProfileId: this.activeProfileId,
      profiles: this.profiles
    };
  }

  getActiveProfile() {
    const p = this.profiles.find(x => x.id === this.activeProfileId);
    return p || this.profiles[0];
  }

  getActiveMode() {
    const prof = this.getActiveProfile();
    if (!prof || !prof.modes || prof.modes.length === 0) return null;
    const idx = prof.activeModeIndex || 0;
    return prof.modes[idx] || prof.modes[0];
  }

  setActiveProfile(profileId) {
    const found = this.profiles.find(x => x.id === profileId);
    if (found) {
      this.activeProfileId = profileId;
      this.save();
      return true;
    }
    return false;
  }

  setActiveModeIndex(profileId, modeIndex) {
    const p = this.profiles.find(x => x.id === profileId);
    if (p && p.modes && modeIndex >= 0 && modeIndex < p.modes.length) {
      p.activeModeIndex = modeIndex;
      this.save();
      return p.modes[modeIndex];
    }
    return null;
  }

  nextMode() {
    const prof = this.getActiveProfile();
    if (!prof || !prof.modes || prof.modes.length <= 1) return this.getActiveMode();
    let nextIdx = (prof.activeModeIndex || 0) + 1;
    if (nextIdx >= prof.modes.length) nextIdx = 0;
    prof.activeModeIndex = nextIdx;
    this.save();
    return {
      profile: prof,
      mode: prof.modes[nextIdx],
      modeIndex: nextIdx,
      totalModes: prof.modes.length
    };
  }

  prevMode() {
    const prof = this.getActiveProfile();
    if (!prof || !prof.modes || prof.modes.length <= 1) return this.getActiveMode();
    let prevIdx = (prof.activeModeIndex || 0) - 1;
    if (prevIdx < 0) prevIdx = prof.modes.length - 1;
    prof.activeModeIndex = prevIdx;
    this.save();
    return {
      profile: prof,
      mode: prof.modes[prevIdx],
      modeIndex: prevIdx,
      totalModes: prof.modes.length
    };
  }

  updateActiveModeOptions(newOptions) {
    const prof = this.getActiveProfile();
    if (!prof || !prof.modes) return null;
    const mode = prof.modes[prof.activeModeIndex || 0];
    if (mode) {
      Object.assign(mode, newOptions);
      this.save();
      return mode;
    }
    return null;
  }

  // ⭐ THÊM GAME MỚI TÙY CHỈNH
  addProfile({ name, icon, category, modes }) {
    if (!name || !name.trim()) return null;
    const id = 'game_' + Date.now().toString(36);
    const newProf = {
      id: id,
      name: name.trim(),
      icon: (icon && icon.trim()) ? icon.trim() : '🎮',
      category: (category && category.trim()) ? category.trim() : 'Game Tùy Chỉnh',
      activeModeIndex: 0,
      modes: (Array.isArray(modes) && modes.length > 0) ? modes : [
        {
          id: id + '_mode1',
          name: 'Chế Độ Thi Đấu Mượt Mà (120 FPS)',
          tag: '120 FPS',
          fps: 120,
          bitrate: '16M',
          maxSize: 1080,
          codec: 'h265',
          displayBuffer: 0,
          audioBuffer: 10,
          stayAwake: true,
          turnScreenOff: false,
          forwardAudio: true,
          mirrorScreen: true,
          renderDriver: 'direct3d11',
          description: 'Tối ưu độ trễ 0ms phản xạ nhanh.'
        },
        {
          id: id + '_mode2',
          name: 'Chế Độ Cân Bằng (90 FPS)',
          tag: 'Cân Bằng',
          fps: 90,
          bitrate: '12M',
          maxSize: 1080,
          codec: 'h264',
          displayBuffer: 10,
          audioBuffer: 20,
          stayAwake: true,
          turnScreenOff: false,
          forwardAudio: true,
          mirrorScreen: true,
          renderDriver: 'direct3d11',
          description: 'Cân bằng hình ảnh và mượt mà, chống nóng máy.'
        }
      ]
    };

    this.profiles.push(newProf);
    this.activeProfileId = id;
    this.save();
    return newProf;
  }

  // ⭐ XÓA PROFILE GAME
  deleteProfile(profileId) {
    if (this.profiles.length <= 1) return false; // Không xóa hết profile cuối cùng
    const idx = this.profiles.findIndex(p => p.id === profileId);
    if (idx !== -1) {
      this.profiles.splice(idx, 1);
      if (this.activeProfileId === profileId) {
        this.activeProfileId = this.profiles[0].id;
      }
      this.save();
      return true;
    }
    return false;
  }

  // ⭐ CẬP NHẬT PROFILE GAME
  updateProfile(profileId, data) {
    const prof = this.profiles.find(p => p.id === profileId);
    if (prof) {
      if (data.name) prof.name = data.name.trim();
      if (data.icon) prof.icon = data.icon.trim();
      if (data.category) prof.category = data.category.trim();
      this.save();
      return prof;
    }
    return null;
  }

  importProfiles(data) {
    if (!data) return false;
    let profilesList = null;
    let activeId = null;

    if (Array.isArray(data)) {
      profilesList = data;
    } else if (data.profiles && Array.isArray(data.profiles)) {
      profilesList = data.profiles;
      activeId = data.activeProfileId;
    }

    if (profilesList && profilesList.length > 0) {
      this.profiles = profilesList;
      if (activeId && this.profiles.some(p => p.id === activeId)) {
        this.activeProfileId = activeId;
      } else {
        this.activeProfileId = this.profiles[0].id;
      }
      this.save();
      return true;
    }
    return false;
  }

  exportJsonString() {
    return JSON.stringify({
      activeProfileId: this.activeProfileId,
      exportedAt: new Date().toISOString(),
      profiles: this.profiles
    }, null, 2);
  }
}

module.exports = ProfileManager;
