/**
 * app.js — 主控制器（主页 + 学习，多语库）
 */
const App = {
  libraries: [],
  currentLib: null,
  allCards: [],
  studyQueue: [],
  currentIndex: 0,
  revealed: false,
  route: 'home',

  async init() {
    try {
      const index = await Dictionary.loadIndex();
      this.libraries = index.libraries;
    } catch (e) {
      document.getElementById('content').innerHTML = UI.renderEmpty('加载失败', '请确保 data/index.json 存在');
      return;
    }
    this.currentLib = Storage.getCurrentLibrary();
    if (this.currentLib) {
      try { await Dictionary.loadLibrary(this.currentLib); this.allCards = Dictionary.getCards(); }
      catch (e) { this.currentLib = null; }
    }
    this.bindNav();
    this.navigate('home');
  },

  bindNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.navigate(btn.dataset.route);
      };
    });
  },

  navigate(route) {
    this.route = route;
    const title = document.getElementById('page-title');
    const content = document.getElementById('content');
    // 更新导航栏 active 状态
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.route === route);
    });
    switch (route) {
      case 'home':
        title.textContent = 'SentenceVocab';
        content.innerHTML = UI.renderHome(this.libraries, this.currentLib);
        break;
      case 'study':
        title.textContent = '学习';
        this.renderStudy();
        break;
    }
  },

  // 单击选中语库
  async selectLibrary(libId) {
    this.currentLib = libId;
    Storage.setCurrentLibrary(libId);
    try {
      await Dictionary.loadLibrary(libId);
      this.allCards = Dictionary.getCards();
    } catch (e) {
      alert('加载语库失败');
      return;
    }
    // 刷新选中状态
    document.querySelectorAll('.lib-card').forEach(el => {
      el.classList.toggle('active', el.dataset.libId === libId);
    });
  },

  // 双击跳转学习
  async selectLibraryAndStudy(libId) {
    await this.selectLibrary(libId);
    this.navigate('study');
  },

  renderStudy() {
    const content = document.getElementById('content');
    if (!this.currentLib) {
      content.innerHTML = UI.renderEmpty('未选择语库', '请先在主页选择一个语库');
      return;
    }
    this.studyQueue = SRS.getStudyQueue(this.allCards, this.currentLib);
    this.currentIndex = 0;
    this.revealed = false;
    if (this.studyQueue.length === 0) {
      const p = SRS.getProgress(this.allCards, this.currentLib);
      content.innerHTML = this.renderDone(p);
      return;
    }
    this.renderCurrentCard();
  },

  renderDone(p) {
    return `<div class="empty-state">
      <h3>语库已学完！</h3>
      <p>共 ${p.total} 句，已学 ${p.learned} 句 (${p.percent}%)</p>
      <button class="rate-btn rate-good" style="margin-top:16px;width:auto;padding:10px 24px" onclick="App.resetProgress()">重置进度</button>
    </div>`;
  },

  renderCurrentCard() {
    const content = document.getElementById('content');
    if (this.currentIndex >= this.studyQueue.length) {
      const p = SRS.getProgress(this.allCards, this.currentLib);
      content.innerHTML = this.renderDone(p);
      return;
    }
    const { card } = this.studyQueue[this.currentIndex];
    content.innerHTML = UI.renderCard(card, this.currentIndex, this.studyQueue.length, this.revealed);
  },

  reveal() {
    this.revealed = true;
    this.renderCurrentCard();
  },

  rate(quality) {
    const item = this.studyQueue[this.currentIndex];
    if (!item) return;
    const isNew = item.state.status === 'new';
    const newState = SRS.schedule(item.state, quality);
    Storage.setCardState(this.currentLib, item.card.id, newState);
    this.recordStats(item.card.id, quality, isNew);
    this.currentIndex++;
    this.revealed = false;
    this.renderCurrentCard();
  },

  recordStats(cardId, quality, isNew) {
    const libId = this.currentLib;
    const stats = Storage.getStats(libId);
    const today = new Date().toISOString().slice(0, 10);
    const td = stats.dailyHistory[today] || { new: 0, review: 0 };
    if (isNew) { td.new++; stats.totalStudied++; }
    else { td.review++; stats.totalReviewed++; }
    stats.dailyHistory[today] = td;
    if (stats.lastStudyDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      stats.streak = stats.lastStudyDate === yesterday ? stats.streak + 1 : 1;
      stats.lastStudyDate = today;
    }
    Storage.setStats(libId, stats);
  },

  resetProgress() {
    if (!this.currentLib) return;
    if (!confirm('确定重置当前语库进度？')) return;
    Storage.clearCardStates(this.currentLib);
    alert('已重置');
    this.navigate('study');
  },

  async syncPush() {
    try { await Gist.push(); alert('同步成功'); }
    catch (e) { alert('同步失败: ' + e.message); }
  },

  async syncPull() {
    try { await Gist.pull(); alert('拉取成功'); this.navigate('home'); }
    catch (e) { alert('拉取失败: ' + e.message); }
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
