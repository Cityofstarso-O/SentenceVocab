/**
 * gist.js — GitHub Gist 同步
 */
const Gist = {
  API: 'https://api.github.com/gists',
  FILENAME: 'progress.json',

  getHeaders() {
    const token = Storage.getSettings().gistToken;
    if (!token) throw new Error('请先填入 Gist Token');
    return {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  },

  async getError(res, action) {
    let detail = '';
    try { const b = await res.json(); detail = b.message || ''; if (b.errors) detail += ': ' + JSON.stringify(b.errors); } catch {}
    if (res.status === 401) return `${action}失败: Token 无效或已过期，请重新生成`;
    if (res.status === 403) return `${action}失败: Token 没有 gist 权限，创建 Token 时需勾选 gist`;
    return `${action}失败 (${res.status}): ${detail}`;
  },

  // 用 Token 自动查找已有的 SentenceVocab Gist
  async findGistId() {
    const res = await fetch(`${this.API}?per_page=100`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(await this.getError(res, '查找 Gist'));
    const gists = await res.json();
    // 找包含 progress.json 文件的 Gist
    const found = gists.find(g => g.files && g.files[this.FILENAME]);
    return found ? found.id : null;
  },

  async create() {
    const data = Storage.exportAll();
    const body = {
      description: 'SentenceVocab progress backup',
      public: false,
      files: { [this.FILENAME]: { content: JSON.stringify(data, null, 2) } },
    };
    const res = await fetch(this.API, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await this.getError(res, '创建 Gist'));
    const gist = await res.json();
    Storage.setSettings({ gistId: gist.id, lastSyncAt: Date.now() });
    return gist.id;
  },

  async push() {
    let gistId = Storage.getSettings().gistId;
    if (!gistId) {
      // 没存 ID → 先尝试自动找，找不到再创建
      gistId = await this.findGistId();
      if (gistId) Storage.setSettings({ gistId });
    }
    if (!gistId) gistId = await this.create();
    const data = Storage.exportAll();
    const res = await fetch(`${this.API}/${gistId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ files: { [this.FILENAME]: { content: JSON.stringify(data, null, 2) } } }),
    });
    if (!res.ok) throw new Error(await this.getError(res, '推送'));
    Storage.setSettings({ lastSyncAt: Date.now() });
  },

  async pull() {
    let gistId = Storage.getSettings().gistId;
    // 没存 ID → 用 Token 自动找
    if (!gistId) {
      gistId = await this.findGistId();
      if (!gistId) throw new Error('未找到云端数据，请先在一台设备上点「同步到云端」');
      Storage.setSettings({ gistId });
    }
    const res = await fetch(`${this.API}/${gistId}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(await this.getError(res, '拉取'));
    const gist = await res.json();
    const file = gist.files[this.FILENAME];
    if (!file) throw new Error('Gist 中无 progress.json');
    const data = JSON.parse(file.content);
    Storage.importAll(data);
    return data;
  },
};
