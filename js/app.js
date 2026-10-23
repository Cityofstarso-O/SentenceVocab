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
  editMode: false,
  sceneState: null,
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
    CardAudio.stop();
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
        this.checkUpdate();
        break;
      case 'study':
        title.textContent = '学习';
        this.renderStudy();
        break;
    }
  },

  // 检查远程是否有更新（异步，无网静默失败）
  async checkUpdate() {
    const el = document.getElementById('update-hint');
    if (!el) return;
    const updated = await Gist.checkRemoteUpdated();
    if (updated === true) {
      el.textContent = '⚠️ 远程有更新的进度，建议先拉取';
      el.style.display = 'block';
    } else if (updated === false) {
      el.textContent = '✅ 本地已是最新';
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
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
    this.editMode = false;
    this.sceneState = null;
    if (this.studyQueue.length === 0) {
      const p = SRS.getProgress(this.allCards, this.currentLib);
      content.innerHTML = this.renderDone(p);
      return;
    }
    this.renderCurrentCard();
  },

  renderDone(p) {
    const unit = this.unitName();
    return `<div class="empty-state">
      <h3>语库已学完！</h3>
      <p>共 ${p.total} ${unit}，已会 ${p.learned} ${unit} (${p.percent}%)</p>
      <button class="rate-btn rate-good" style="margin-top:16px;width:auto;padding:10px 24px" onclick="App.resetProgress()">重置进度</button>
    </div>`;
  },

  renderCurrentCard() {
    const content = document.getElementById('content');
    CardAudio.stop();
    if (this.currentIndex >= this.studyQueue.length) {
      const p = SRS.getProgress(this.allCards, this.currentLib);
      content.innerHTML = this.renderDone(p);
      return;
    }
    const item = this.studyQueue[this.currentIndex];
    const p = SRS.getProgress(this.allCards, this.currentLib);
    if (this.isScene()) {
      // 场景卡：显示状态在卡内自管理，「下一张」= rate(GOOD) 记会出队
      if (!this.sceneState) this.sceneState = this.initSceneState(item.card);
      content.innerHTML = UI.renderSceneCard(item.card, p, this.sceneState);
      this.bindSceneGestures();
      this.layoutSceneLabels();
      return;
    }
    content.innerHTML = UI.renderCard(item.card, p, this.revealed, this.editMode);
    // 听力模式：每次进入未揭示的新卡自动播放（无音频/被浏览器拦截时静默，可点 🔊 重听）
    if (!this.revealed && this.isListening()) this.playAudio();
  },

  // 朗读当前句子（data/audios/<libId>/<cardId>.mp3）
  playAudio() {
    const item = this.studyQueue[this.currentIndex];
    if (item) CardAudio.play(this.currentLib, item.card.id);
  },

  // 听力模式：未揭示时只听不看，点「不会」才显示原文（揭示态与普通模式完全一致）
  isListening() {
    return !!Storage.getSettings().listeningMode;
  },

  // ---- 场景卡（type: scene，一张图 = 一个场景）----
  // 每个物品三种显示状态：1 原图（无标记）/ 2 原图+圆圈 / 3 原图+圆圈+英文caption
  // 单击：状态 2↔3 自由切换；双击/长按：任意物品 → 状态 1
  // 状态 1 只能通过整体切换按钮回到 2/3：按钮每次点击把所有物品强制设为同一状态（1→2→3→1 循环）
  // 「下一张」= 浏览完毕记「会」出队

  isScene() {
    return Dictionary.getType() === 'scene';
  },

  // 进度文案的量词：句子库用「句」，场景库用「张」
  unitName() {
    return this.isScene() ? '张' : '句';
  },

  // 进入一张场景卡时初始化：全部物品从状态 2（仅圆圈）开始
  initSceneState(card) {
    const states = {};
    card.items.forEach((_, i) => { states[i] = 2; });
    return { states, forceLevel: null };
  },

  // 单击物品：状态 2↔3 自由切换；状态 1 不响应
  tapItem(idx) {
    const st = this.sceneState;
    if (!st) return;
    if (st.states[idx] === 1) return;
    st.states[idx] = st.states[idx] === 2 ? 3 : 2;
    this.renderCurrentCard();
  },

  // 双击/长按物品 → 状态 1（隐藏标记，仅整体切换可恢复）
  hideItem(idx) {
    const st = this.sceneState;
    if (!st) return;
    st.states[idx] = 1;
    this.renderCurrentCard();
  },

  // 整体强制切换：所有物品（含已隐藏的）依次设为状态 1→2→3→1
  sceneForceCycle() {
    const st = this.sceneState;
    if (!st) return;
    st.forceLevel = st.forceLevel === null ? 1 : (st.forceLevel % 3) + 1;
    const card = this.studyQueue[this.currentIndex].card;
    card.items.forEach((_, i) => { st.states[i] = st.forceLevel; });
    this.renderCurrentCard();
  },

  // 长按手势（500ms）：pointerdown 起计时，移动/抬起取消；委托绑定，渲染后无需重绑
  bindSceneGestures() {
    if (this._gesturesBound) return;
    this._gesturesBound = true;
    let timer = null;
    document.addEventListener('pointerdown', (e) => {
      const pin = e.target.closest('.scene-pin');
      if (!pin) return;
      const idx = +pin.dataset.idx;
      timer = setTimeout(() => { timer = null; this.hideItem(idx); }, 500);
    });
    ['pointerup', 'pointercancel', 'pointermove'].forEach(ev =>
      document.addEventListener(ev, () => {
        if (timer) { clearTimeout(timer); timer = null; }
      })
    );
    // 长按时抑制系统右键/选择菜单
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.scene-pin')) e.preventDefault();
    });
    // 视口变化后重排 caption（非场景卡时内部自动跳过）
    window.addEventListener('resize', () => this.layoutSceneLabels());
  },

  // caption 碰撞避让排版：渲染后调用。
  // 每个标签依次尝试 右→左→正上→右上→左上→正下 六个候选位，
  // 取第一个与已摆放标签无重叠且不超出图片边界的位置；全部冲突时取重叠面积最小者。
  layoutSceneLabels() {
    const stage = document.querySelector('.scene-stage');
    if (!stage) return;
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    const GAP = 12; // 圆点半径 + 间隙
    const placed = [];
    const overlapArea = (a, b) => {
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return ox > 0 && oy > 0 ? ox * oy : 0;
    };

    const labels = [...stage.querySelectorAll('.scene-pin-label')]
      .map((l) => {
        const pin = stage.querySelector(`.scene-pin[data-idx="${l.dataset.idx}"]`);
        return {
          l,
          cx: parseFloat(pin.style.left) / 100 * W,
          cy: parseFloat(pin.style.top) / 100 * H,
        };
      })
      .sort((a, b) => a.cy - b.cy || a.cx - b.cx); // 自上而下摆放

    for (const it of labels) {
      const w = it.l.offsetWidth, h = it.l.offsetHeight;
      if (!w || !h) continue;
      const candidates = [
        [it.cx + GAP, it.cy - h / 2],   // 右侧
        [it.cx - GAP - w, it.cy - h / 2], // 左侧
        [it.cx - w / 2, it.cy - GAP - h], // 正上
        [it.cx + GAP, it.cy - GAP - h],   // 右上
        [it.cx - GAP - w, it.cy - GAP - h], // 左上
        [it.cx - w / 2, it.cy + GAP],   // 正下
      ];
      const inBounds = candidates.filter(([x, y]) => x >= 0 && y >= 0 && x + w <= W && y + h <= H);
      const pool = inBounds.length ? inBounds : candidates;
      let best = pool[0], bestOverlap = Infinity;
      for (const cand of pool) {
        const rect = { x: cand[0], y: cand[1], w, h };
        const ov = placed.reduce((s, r) => s + overlapArea(rect, r), 0);
        if (ov === 0) { best = cand; break; }
        if (ov < bestOverlap) { bestOverlap = ov; best = cand; }
      }
      placed.push({ x: best[0], y: best[1], w, h });
      it.l.style.left = best[0] + 'px';
      it.l.style.top = best[1] + 'px';
    }
  },

  toggleListeningMode() {
    Storage.setSettings({ listeningMode: !this.isListening() });
    // 就地更新开关，不整页重渲染（保持语库区展开状态）
    const btn = document.getElementById('set-listening');
    if (btn) {
      const on = this.isListening();
      btn.classList.toggle('on', on);
      btn.textContent = on ? '开' : '关';
    }
  },

  // 获取有效 keyWords：有覆盖用覆盖，没有用原数据
  getEffectiveKeyWords(card) {
    const override = Storage.getCardOverride(this.currentLib, card.id);
    if (override && override.keyWords) return override.keyWords;
    return card.keyWords || [];
  },

  // 获取卡片问题标签
  getCardIssues(card) {
    const override = Storage.getCardOverride(this.currentLib, card.id);
    if (override && override.issues) return override.issues;
    return [];
  },

  reveal() {
    this.revealed = true;
    this.editMode = false;
    this.renderCurrentCard();
  },

  // 进入反馈编辑模式
  enterFeedback() {
    this.editMode = true;
    this.renderCurrentCard();
  },

  // 退出反馈模式，保存覆盖
  exitFeedback() {
    this.editMode = false;
    this.renderCurrentCard();
  },

  // 复原：清空当前卡片的覆盖
  resetOverride() {
    const card = this.studyQueue[this.currentIndex].card;
    Storage.removeCardOverride(this.currentLib, card.id);
    this.renderCurrentCard();
  },

  // 切换某个词的生词状态
  toggleWord(word) {
    const card = this.studyQueue[this.currentIndex].card;
    // 操作副本：直接修改 card.keyWords 原始数组会让「复原」失效（原始数据被污染）
    const keyWords = this.getEffectiveKeyWords(card).map(kw => ({ ...kw }));
    const w = word.toLowerCase();
    const idx = keyWords.findIndex(kw => kw.word.toLowerCase() === w);
    if (idx >= 0) {
      keyWords.splice(idx, 1);
    } else {
      keyWords.push({ word: w, phonetic: '', meaning_cn: '' });
    }
    Storage.setCardOverride(this.currentLib, card.id, { keyWords });
    this.renderCurrentCard();
  },

  // 切换问题标签
  toggleIssue(issue) {
    const card = this.studyQueue[this.currentIndex].card;
    const issues = this.getCardIssues(card);
    const idx = issues.indexOf(issue);
    if (idx >= 0) {
      issues.splice(idx, 1);
    } else {
      issues.push(issue);
    }
    Storage.setCardOverride(this.currentLib, card.id, { issues });
    this.renderCurrentCard();
  },

  rate(quality) {
    const item = this.studyQueue[this.currentIndex];
    if (!item) return;
    if (quality === SRS.QUALITY_GOOD) {
      // 点会：永久移除，直到重置
      Storage.setMastered(this.currentLib, item.card.id, true);
      this.studyQueue.splice(this.currentIndex, 1);
    } else {
      // 点不会：随机插到 10-20 句之后，避免忘得太早
      const [cur] = this.studyQueue.splice(this.currentIndex, 1);
      const offset = 10 + Math.floor(Math.random() * 11); // 10 ~ 20
      const insertPos = Math.min(this.currentIndex + offset, this.studyQueue.length);
      this.studyQueue.splice(insertPos, 0, cur);
    }
    this.recordStats(quality);
    Storage.touchUpdatedAt();

    if (this.studyQueue.length === 0) {
      const p = SRS.getProgress(this.allCards, this.currentLib);
      document.getElementById('content').innerHTML = this.renderDone(p);
      return;
    }
    if (this.currentIndex >= this.studyQueue.length) {
      this.currentIndex = 0;
    }
    this.revealed = false;
    this.editMode = false;
    this.sceneState = null;
    this.renderCurrentCard();
  },

  recordStats(quality) {
    const libId = this.currentLib;
    const stats = Storage.getStats(libId);
    const today = new Date().toISOString().slice(0, 10);
    const td = stats.dailyHistory[today] || { new: 0, review: 0 };
    if (quality === SRS.QUALITY_GOOD) { td.new++; stats.totalStudied++; }
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
    Storage.clearMastered(this.currentLib);
    alert('已重置');
    this.navigate('study');
  },

  // 从输入框读取并保存 Token
  saveInputs() {
    const tokenInput = document.getElementById('set-token');
    if (tokenInput && tokenInput.value.trim()) {
      Storage.setSettings({ gistToken: tokenInput.value.trim() });
    }
  },

  async syncPush() {
    try {
      this.saveInputs();
      await Gist.push();
      alert('同步成功');
    } catch (e) {
      if (e.remoteNewer) {
        if (confirm('远程有更新的进度，本地推送会覆盖它。\n\n确定要用本地进度覆盖远程吗？')) {
          try {
            await Gist.push(true);
            alert('已覆盖远程进度');
          } catch (e2) { alert('同步失败: ' + e2.message); }
        }
      } else {
        alert('同步失败: ' + e.message);
      }
    }
  },

  async syncPull() {
    try {
      this.saveInputs();
      await Gist.pull();
      alert('拉取成功');
      this.navigate('home');
    } catch (e) { alert('拉取失败: ' + e.message); }
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
