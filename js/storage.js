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
      if (key && key.startsWith(this.PREFIX)) all[key] = localStorage.getItem(key);
    }
    return all;
  },
  importAll(data) {
    for (const [key, val] of Object.entries(data)) localStorage.setItem(key, val);
  },
};
