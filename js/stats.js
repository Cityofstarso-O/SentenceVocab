/**
 * stats.js — 统计与学习日历
 */
const Stats = {
  get() { return Storage.getStats(); },

  recordStudy(cardId, quality, isNew) {
    const stats = Storage.getStats();
    const today = new Date().toISOString().slice(0, 10);
    const todayData = stats.dailyHistory[today] || { new: 0, review: 0 };
    if (isNew) { todayData.new++; stats.totalStudied++; }
    else { todayData.review++; stats.totalReviewed++; }
    stats.dailyHistory[today] = todayData;
    if (stats.lastStudyDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (stats.lastStudyDate === yesterday) stats.streak++;
      else stats.streak = 1;
      stats.lastStudyDate = today;
    }
    Storage.setStats(stats);
    return stats;
  },

  render() {
    const stats = this.get();
    const states = Storage.getCardStates();
    const totalCards = Dictionary.getCards().length;
    const learned = Object.values(states).filter(s => s.status !== 'new').length;
    const now = Date.now();
    const dueNow = Object.values(states).filter(s => s.status !== 'new' && s.due <= now).length;
    const mastered = Object.values(Storage.getWordNotes() || {}).filter(n => n.mastered).length;

    let heatmap = '';
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const d = stats.dailyHistory[date];
      const total = d ? d.new + d.review : 0;
      let cls = '';
      if (total > 0) cls = 'l1';
      if (total >= 10) cls = 'l2';
      if (total >= 20) cls = 'l3';
      if (total >= 30) cls = 'l4';
      heatmap += `<div class="heat-cell ${cls}" title="${date}: ${total}"></div>`;
    }

    const progress = totalCards > 0 ? Math.round(learned / totalCards * 100) : 0;
    return `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${stats.streak}</div><div class="stat-label">连续天数</div></div>
        <div class="stat-card"><div class="stat-value">${progress}%</div><div class="stat-label">总进度 (${learned}/${totalCards})</div></div>
        <div class="stat-card"><div class="stat-value">${dueNow}</div><div class="stat-label">待复习</div></div>
        <div class="stat-card"><div class="stat-value">${mastered}</div><div class="stat-label">已掌握词</div></div>
      </div>
      <div class="stats-section"><h4>最近 30 天</h4><div class="heatmap">${heatmap}</div></div>
      <div class="stats-section"><h4>累计</h4><p>新学 ${stats.totalStudied} 张 | 复习 ${stats.totalReviewed} 次</p></div>
    `;
  },
};
