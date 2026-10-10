/**
 * storage.js — localStorage 封装（支持多语库）
 */
const Storage = {
  PREFIX: 'sv_',

  get(key) {
    const raw = localStorage.getItem(this.PREFIX + key);
    if (raw === null || raw === undefined) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  },
  set(key, val) {
    localStorage.setItem(this.PREFIX + key, JSON.stringify(val));
  },
  remove(key) {
    localStorage.removeItem(this.PREFIX + key);
  },

  getCurrentLibrary() {
    return this.get('current_library') || null;
  },
  setCurrentLibrary(id) {
    this.set('current_library', id);
  },

  // 已会卡片（mastered 机制：会=移除，不会=留下），存储为 { libId: [cardId, ...] }
  getMastered(libId) {
    const all = this.get('mastered') || {};
    return all[libId] || [];
  },
  setMastered(libId, cardId, mastered) {
    const all = this.get('mastered') || {};
    const list = all[libId] || [];
    const id = Number(cardId);
    const idx = list.indexOf(id);
    if (mastered && idx === -1) {
      list.push(id);
      list.sort((a, b) => a - b);
    } else if (!mastered && idx !== -1) {
      list.splice(idx, 1);
    }
    all[libId] = list;
    this.set('mastered', all);
  },
  clearMastered(libId) {
    const all = this.get('mastered') || {};
    delete all[libId];
    this.set('mastered', all);
    const stats = this.get('stats') || {};
    delete stats[libId];
    this.set('stats', stats);
  },

  getStats(libId) {
    const all = this.get('stats') || {};
    return all[libId] || {
      streak: 0, lastStudyDate: null,
      totalStudied: 0, totalReviewed: 0,
      dailyHistory: {},
    };
  },
  setStats(libId, stats) {
    const all = this.get('stats') || {};
    all[libId] = stats;
    this.set('stats', all);
  },

  // 卡片级 keyWords 覆盖（反馈功能），存储为 { libId: { cardId: {...} } }
  getCardOverride(libId, cardId) {
    const all = this.get('overrides') || {};
    const lib = all[libId] || {};
    return lib[String(cardId)] || null;
  },
  setCardOverride(libId, cardId, data) {
    const all = this.get('overrides') || {};
    const lib = all[libId] || {};
    const existing = lib[String(cardId)] || {};
    lib[String(cardId)] = { ...existing, ...data };
    all[libId] = lib;
    this.set('overrides', all);
  },
  removeCardOverride(libId, cardId) {
    const all = this.get('overrides') || {};
    const lib = all[libId] || {};
    delete lib[String(cardId)];
    all[libId] = lib;
    this.set('overrides', all);
  },

  // 进度最后更新时间戳（学习时更新，用于防旧进度覆盖）
  touchUpdatedAt() {
    this.set('updated_at', String(Date.now()));
  },
  getUpdatedAt() {
    const v = this.get('updated_at');
    return v ? parseInt(v, 10) : 0;
  },

  getSettings() {
    return this.get('settings') || { gistToken: '', gistId: '', lastSyncAt: null };
  },
  setSettings(settings) {
    this.set('settings', { ...this.getSettings(), ...settings });
  },

  exportAll() {
    const all = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(this.PREFIX)) continue;
      const name = key.slice(this.PREFIX.length);
      // 白名单：只导出有效字段，其余一律忽略
      const valid =
        name === 'current_library' ||
        name === 'updated_at' ||
        name === 'settings' ||
        name === 'mastered' ||
        name === 'stats' ||
        name === 'overrides';
      if (!valid) continue;
      // settings 中包含 gistToken，同步时必须排除，否则 GitHub 会扫描到并撤销 Token
      if (key === this.PREFIX + 'settings') {
        const settings = JSON.parse(localStorage.getItem(key) || '{}');
        all[key] = JSON.stringify({ ...settings, gistToken: '' });
      } else {
        all[key] = localStorage.getItem(key);
      }
    }
    return all;
  },
  importAll(data) {
    for (const [key, val] of Object.entries(data)) {
      // 拉取时不覆盖本地 Token，保留当前设备的 Token
      if (key === this.PREFIX + 'settings') {
        const cloudSettings = JSON.parse(val);
        const localSettings = this.getSettings();
        // 只同步 gistId 和 lastSyncAt，不动 gistToken
        this.setSettings({
          gistId: cloudSettings.gistId || localSettings.gistId,
          lastSyncAt: cloudSettings.lastSyncAt,
        });
      } else {
        localStorage.setItem(key, val);
      }
    }
  },
};
