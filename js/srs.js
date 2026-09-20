/**
 * srs.js — SM-2 间隔重复算法（支持多语库）
 */
const SRS = {
  QUALITY_FAIL: 0,
  QUALITY_GOOD: 5,

  newCardState() {
    return { repetition: 0, interval: 0, efactor: 2.5, due: 0, status: 'new', lastReview: null };
  },

  schedule(cardState, quality) {
    let { repetition, interval, efactor } = cardState;
    const now = Date.now();
    if (quality < 3) { repetition = 0; interval = 0; }
    else {
      if (repetition === 0) interval = 1;
      else if (repetition === 1) interval = 3;
      else interval = Math.round(interval * efactor);
      repetition++;
    }
    efactor = Math.max(1.3, efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    const due = quality < 3 ? now + 600000 : now + interval * 86400000;
    return { repetition, interval, efactor, due, status: quality < 3 ? 'learning' : 'review', lastReview: now };
  },

  getStudyQueue(allCards, libId) {
    const now = Date.now();
    const states = Storage.getCardStates(libId);
    const queue = [];
    for (const card of allCards) {
      const state = states[String(card.id)] || this.newCardState();
      if (state.status === 'new' || state.due <= now) queue.push({ card, state });
    }
    // 随机打乱顺序
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
  },

  getProgress(allCards, libId) {
    const states = Storage.getCardStates(libId);
    const total = allCards.length;
    let learned = 0, dueNow = 0, newCount = 0;
    const now = Date.now();
    for (const card of allCards) {
      const state = states[String(card.id)];
      if (!state || state.status === 'new') newCount++;
      else { learned++; if (state.due <= now) dueNow++; }
    }
    return { total, learned, dueNow, newCount, percent: total > 0 ? Math.round(learned / total * 100) : 0 };
  },
};
