/**
 * ui.js — UI 渲染
 */
const UI = {
  // 主页：语库收纳 + 设置
  renderHome(libraries, currentLib) {
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
        <div class="settings-item"><button onclick="App.syncPush()">同步到云端</button></div>
        <div class="settings-item"><button class="btn-secondary" onclick="App.syncPull()">从云端拉取</button></div>
        <div class="settings-item"><button class="btn-danger" onclick="App.clearOverrides()">清除已处理的反馈</button></div>
      </div>`;
  },

  // 学习卡片
  renderCard(card, index, total, revealed, editMode) {
    const progress = total > 0 ? Math.round((index + 1) / total * 100) : 0;

    // 未揭示：纯英文 + 会/不会
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

    // 获取有效 keyWords（有覆盖用覆盖）
    const keyWords = App.getEffectiveKeyWords(card);
    const keyWordSet = new Set(keyWords.map(kw => kw.word.toLowerCase()));

    // 揭示状态：英文句子 + 翻译 + 生词列表 + 反馈按钮
    const translationHtml = card.translation
      ? `<div class="card-translation">${card.translation}</div>` : '';

    const wordDetailsHtml = keyWords.map(kw => {
      return `<div class="word-detail">
        <span class="wd-word">${kw.word}</span>
        <span class="wd-phonetic">${kw.phonetic || ''}</span>
        <span class="wd-meaning">${kw.meaning_cn || ''}</span>
      </div>`;
    }).join('');

    // 反馈模式：句子中每个词可点击切换
    if (editMode) {
      const words = card.text.split(/\s+/);
      const sentenceHtml = words.map(w => {
        const clean = w.replace(/[.,;:!?"'()]/g, '').toLowerCase();
        const isKey = keyWordSet.has(clean);
        return `<span class="edit-word ${isKey ? 'selected' : ''}" onclick="App.toggleWord('${clean}')">${w}</span>`;
      }).join(' ');

      const issues = App.getCardIssues(card);
      const issueTags = ['单词大小写或标点存在错误', '缺乏语境难以体现生词意思'].map(tag => {
        const active = issues.includes(tag);
        return `<button class="issue-tag ${active ? 'active' : ''}" onclick="App.toggleIssue('${tag}')">${tag}</button>`;
      }).join('');

      return `
        <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
        <div class="progress-text">${index + 1} / ${total}</div>
        <div class="card">
          <div class="card-text">${sentenceHtml}</div>
          <div class="edit-hint">点击词语切换生词状态（蓝色=已选）</div>
          <div class="issue-tags">
            <div class="issue-tags-title">其他问题</div>
            ${issueTags}
          </div>
        </div>
        <div class="rate-buttons">
          <button class="rate-btn rate-fail" onclick="App.resetOverride()">复原</button>
          <button class="rate-btn rate-good" onclick="App.exitFeedback()">完成</button>
        </div>`;
    }

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
      </div>
      <button class="feedback-btn" onclick="App.enterFeedback()">反馈：标注有误？</button>`;
  },

  renderEmpty(title, msg) {
    return `<div class="empty-state"><h3>${title}</h3><p>${msg}</p></div>`;
  },
};
