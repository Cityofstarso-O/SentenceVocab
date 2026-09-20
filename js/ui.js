/**
 * ui.js — UI 渲染
 */
const UI = {
  // 主页：语库收纳 + 设置
  renderHome(libraries, currentLib) {
    // 语库列表（收纳在一个可展开的容器中）
    let libItems = '';
    for (const lib of libraries) {
      const isActive = currentLib === lib.id;
      const states = Storage.getCardStates(lib.id);
      const learned = Object.values(states).filter(s => s.status !== 'new').length;
      const percent = lib.cardCount > 0 ? Math.round(learned / lib.cardCount * 100) : 0;

      libItems += `
        <div class="lib-card ${isActive ? 'active' : ''}" data-lib-id="${lib.id}"
             onclick="App.selectLibrary('${lib.id}')"
             ondblclick="App.selectLibraryAndStudy('${lib.id}')">
          <div class="lib-name">${lib.name}</div>
          <div class="lib-meta">${learned}/${lib.cardCount} 句 | ${percent}%</div>
          <div class="lib-progress-bar"><div class="lib-progress-fill" style="width:${percent}%"></div></div>
        </div>`;
    }

    return `
      <div class="lib-section">
        <div class="lib-section-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span>📚 语库</span>
          <span class="lib-section-count">${libraries.length} 个</span>
          <span class="lib-section-arrow">▾</span>
        </div>
        <div class="lib-list">${libItems}</div>
      </div>
      <p class="lib-hint">单击选中 · 双击跳转学习</p>
      <div class="settings-group" style="margin-top:24px">
        <div class="settings-item">
          <label>Gist Token</label>
          <input type="text" id="set-token" value="${Storage.getSettings().gistToken || ''}" placeholder="ghp_xxx">
        </div>
        <div class="settings-item">
          <label>Gist ID</label>
          <input type="text" id="set-gistid" value="${Storage.getSettings().gistId || ''}" placeholder="首次同步后自动填入，新设备需手动填">
        </div>
        <div class="settings-item"><button onclick="App.syncPush()">同步到云端</button></div>
        <div class="settings-item"><button class="btn-secondary" onclick="App.syncPull()">从云端拉取</button></div>
      </div>`;
  },

  // 学习卡片
  renderCard(card, index, total, revealed) {
    const progress = total > 0 ? Math.round((index + 1) / total * 100) : 0;

    if (!revealed) {
      return `
        <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
        <div class="progress-text">${index + 1} / ${total}</div>
        <div class="card"><div class="card-text">${card.text}</div></div>
        <div class="rate-buttons">
          <button class="rate-btn rate-fail" onclick="App.reveal()">不会</button>
          <button class="rate-btn rate-good" onclick="App.rate(${SRS.QUALITY_GOOD})">会</button>
        </div>`;
    }

    const translationHtml = card.translation
      ? `<div class="card-translation">${card.translation}</div>` : '';

    const wordDetailsHtml = (card.keyWords || []).map(kw => {
      return `<div class="word-detail">
        <span class="wd-word">${kw.word}</span>
        <span class="wd-phonetic">${kw.phonetic || ''}</span>
        <span class="wd-meaning">${kw.meaning_cn || ''}</span>
      </div>`;
    }).join('');

    return `
      <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
      <div class="progress-text">${index + 1} / ${total}</div>
      <div class="card">
        <div class="card-text">${card.text}</div>
        ${translationHtml}
        ${wordDetailsHtml ? `<div class="word-details">${wordDetailsHtml}</div>` : ''}
      </div>
      <div class="rate-buttons">
        <button class="rate-btn rate-fail" onclick="App.rate(${SRS.QUALITY_FAIL})">下一张</button>
      </div>`;
  },

  renderEmpty(title, msg) {
    return `<div class="empty-state"><h3>${title}</h3><p>${msg}</p></div>`;
  },
};
