/**
 * gist.js — GitHub Gist 同步
 */
const Gist = {
  API: 'https://api.github.com/gists',
  FILENAME: 'progress.json',

  getHeaders() {
    const token = Storage.getSettings().gistToken;
    if (!token) throw new Error('未配置 Gist Token');
    return {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  },

  // 创建 Gist
  async create() {
    const data = Storage.exportAll();
    const body = {
      description: 'SentenceVocab progress backup',
      public: false,
      files: {
        [this.FILENAME]: { content: JSON.stringify(data, null, 2) },
      },
    };
    const res = await fetch(this.API, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`创建 Gist 失败: ${res.status}`);
    const gist = await res.json();
    Storage.setSettings({ gistId: gist.id, lastSyncAt: Date.now() });
    return gist.id;
  },

  // 推送
  async push() {
    const settings = Storage.getSettings();
    let gistId = settings.gistId;
    if (!gistId) gistId = await this.create();
    const data = Storage.exportAll();
    const body = {
      files: { [this.FILENAME]: { content: JSON.stringify(data, null, 2) } },
    };
    const res = await fetch(`${this.API}/${gistId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`推送失败: ${res.status}`);
    Storage.setSettings({ lastSyncAt: Date.now() });
  },

  // 拉取
  async pull() {
    const gistId = Storage.getSettings().gistId;
    if (!gistId) throw new Error('未配置 Gist ID');
    const res = await fetch(`${this.API}/${gistId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`拉取失败: ${res.status}`);
    const gist = await res.json();
    const file = gist.files[this.FILENAME];
    if (!file) throw new Error('Gist 中无 progress.json');
    const data = JSON.parse(file.content);
    // 合并策略：云端覆盖本地
    Storage.importAll(data);
    return data;
  },
};
