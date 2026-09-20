/**
 * dictionary.js — 加载语库数据
 */
const Dictionary = {
  data: null,
  libId: null,

  async loadLibrary(libId) {
    this.libId = libId;
    const res = await fetch(`data/json/${libId}.json`);
    this.data = await res.json();
    return this.data;
  },

  async loadIndex() {
    const res = await fetch('data/index.json');
    return await res.json();
  },

  getCards() {
    return this.data ? this.data.cards : [];
  },
};
