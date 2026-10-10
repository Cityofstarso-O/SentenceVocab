/**
 * srs.js — 学习队列管理（会/不会 二分模式）
 * 点「会」→ 永久移除，点「不会」→ 留下之后还会出现
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const SRS = {
  QUALITY_FAIL: 0,
  QUALITY_GOOD: 5,

  // 学习队列 = 所有未会的卡片，随机排列
  getStudyQueue(allCards, libId) {
    const mastered = Storage.getMastered(libId);
    const queue = allCards.filter(c => !mastered.includes(c.id));
    shuffle(queue);
    return queue.map(card => ({ card }));
  },

  // 进度统计
  getProgress(allCards, libId) {
    const mastered = Storage.getMastered(libId);
    const total = allCards.length;
    const learned = mastered.length;
    return {
      total,
      learned,
      remaining: total - learned,
      percent: total > 0 ? Math.round(learned / total * 100) : 0,
    };
  },
};
