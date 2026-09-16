const https = require('https');

class GitHubSync {
  constructor() {}

  /**
   * Helper request to GitHub REST API
   */
  request(endpoint, method, token, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: endpoint,
        method: method,
        headers: {
          'User-Agent': 'Pandakeyauto-App',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      if (token) {
        options.headers['Authorization'] = `token ${token.trim()}`;
      }

      if (data) {
        options.headers['Content-Type'] = 'application/json';
      }

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = body ? JSON.parse(body) : null;
          } catch (e) {
            return reject(new Error('Phản hồi từ GitHub không phải định dạng JSON hợp lệ.'));
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const msg = (parsed && parsed.message) || `HTTP ${res.statusCode}: ${res.statusMessage}`;
            reject(new Error(msg));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  /**
   * Upload profiles to GitHub Gist (create new or update existing)
   */
  async uploadProfiles(token, profilesData, existingGistId = null) {
    if (!token || !token.trim()) {
      throw new Error('Vui lòng nhập GitHub Personal Access Token (PAT) có quyền "gist".');
    }

    const fileName = 'pandakeyauto_profiles.json';
    const content = typeof profilesData === 'string' ? profilesData : JSON.stringify(profilesData, null, 2);

    const payload = {
      description: 'Pandakeyauto Game Profiles Backup & Sync',
      public: false,
      files: {
        [fileName]: {
          content: content
        }
      }
    };

    if (existingGistId && existingGistId.trim()) {
      // Cập nhật Gist hiện có
      const result = await this.request(`/gists/${existingGistId.trim()}`, 'PATCH', token, payload);
      return {
        success: true,
        gistId: result.id,
        htmlUrl: result.html_url,
        updatedAt: result.updated_at,
        message: `Đã đồng bộ lên GitHub Gist thành công! (Gist ID: ${result.id})`
      };
    } else {
      // Tạo Gist mới
      const result = await this.request('/gists', 'POST', token, payload);
      return {
        success: true,
        gistId: result.id,
        htmlUrl: result.html_url,
        updatedAt: result.created_at,
        message: `Đã tạo mới GitHub Gist và lưu trữ profiles! (Gist ID: ${result.id})`
      };
    }
  }

  /**
   * Download profiles from GitHub Gist
   */
  async downloadProfiles(gistId, token = null) {
    if (!gistId || !gistId.trim()) {
      throw new Error('Vui lòng nhập Gist ID để tải về.');
    }

    const result = await this.request(`/gists/${gistId.trim()}`, 'GET', token);
    const fileName = 'pandakeyauto_profiles.json';

    let fileObj = result.files && result.files[fileName];
    if (!fileObj) {
      // Nếu tên file không đúng chuẩn, lấy file json hoặc file đầu tiên
      const keys = Object.keys(result.files || {});
      const jsonKey = keys.find(k => k.endsWith('.json')) || keys[0];
      if (jsonKey) {
        fileObj = result.files[jsonKey];
      }
    }

    if (!fileObj || !fileObj.content) {
      throw new Error('Không tìm thấy nội dung profiles trong Gist này.');
    }

    try {
      const data = JSON.parse(fileObj.content);
      return {
        success: true,
        data: data,
        gistId: result.id,
        updatedAt: result.updated_at,
        message: `Đã tải về thành công profiles từ GitHub Gist (${result.id})!`
      };
    } catch (e) {
      throw new Error('File trong Gist không phải dữ liệu JSON profiles hợp lệ.');
    }
  }
}

module.exports = new GitHubSync();
