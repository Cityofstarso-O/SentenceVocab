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

  getCardStates(libId) {
    return this.get(`cards_${libId}`) || {};
  },
  setCardState(libId, cardId, state) {
    const states = this.getCardStates(libId);
    states[String(cardId)] = state;
    this.set(`cards_${libId}`, states);
  },
  getCardState(libId, cardId) {
    return this.getCardStates(libId)[String(cardId)] || null;
  },
  clearCardStates(libId) {
    this.remove(`cards_${libId}`);
    this.remove(`stats_${libId}`);
  },

  getStats(libId) {
    return this.get(`stats_${libId}`) || {
      streak: 0, lastStudyDate: null,
      totalStudied: 0, totalReviewed: 0,
      dailyHistory: {},
    };
  },
  setStats(libId, stats) {
    this.set(`stats_${libId}`, stats);
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
