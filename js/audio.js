/**
 * audio.js — 句子朗读
 * 音频文件为构建期产物（scripts/gen-audio.js）：data/audios/<libId>/<cardId>.mp3
 * 语库没有音频时静默失败，不影响其他功能
 */
const CardAudio = {
  current: null,

  play(libId, cardId) {
    this.stop();
    const audio = new Audio(`data/audios/${libId}/${cardId}.mp3`);
    audio.preload = 'none'; // 点击时才真正发起下载（浏览器 HTTP 缓存会让同一句只下一次）
    this.current = audio;
    audio.addEventListener('ended', () => { if (this.current === audio) this.current = null; });
    // 404（语库未生成音频）等错误静默处理
    audio.addEventListener('error', () => { if (this.current === audio) this.current = null; });
    audio.play().catch(() => {});
  },

  stop() {
    if (this.current) {
      this.current.pause();
      this.current = null;
    }
  },
};
