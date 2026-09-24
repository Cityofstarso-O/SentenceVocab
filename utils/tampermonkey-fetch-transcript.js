// ==UserScript==
// @name         YouTube 字幕全程记录
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  按 Alt+Shift+S 开始记录字幕，Alt+Shift+X 结束并汇总（同时暂停），最后一秒自动暂停不跳转
// @author       你
// @match        https://www.youtube.com/*
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    let recording = false;
    let captions = [];
    let lastText = '';
    let observer = null;

    // ========== 页面提示 ==========
    function showToast(msg) {
        const old = document.getElementById('caption-copy-toast');
        if (old) old.remove();

        const toast = document.createElement('div');
        toast.id = 'caption-copy-toast';
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: #fff;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 99999;
            pointer-events: none;
            transition: opacity 0.3s;
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 1200);
    }

    // ========== 开始记录 ==========
    function startRecording() {
        if (recording) {
            showToast('已经在记录中了');
            console.log('[字幕记录] 已经在记录中了');
            return;
        }

        recording = true;
        captions = [];
        lastText = '';

        const container = document.querySelector('.ytp-caption-window-container');
        if (!container) {
            showToast('没找到字幕容器，请先开启字幕');
            console.log('[字幕记录] 没找到字幕容器，请先确保字幕已开启并显示');
            recording = false;
            return;
        }

        observer = new MutationObserver(() => {
            if (!recording) return;

            const segments = document.querySelectorAll('.ytp-caption-segment');
            if (segments.length === 0) return;

            const text = [...segments]
                .map(el => el.textContent.trim())
                .filter(Boolean)
                .join(' ');

            if (!text) return;
            if (text === lastText) return;

            lastText = text;
            captions.push(text);
            console.log('[字幕记录] +', text);
        });

        observer.observe(container, {
            childList: true,
            subtree: true,
            characterData: true
        });

        showToast('开始记录字幕');
        console.log('[字幕记录] 开始记录，按 Alt+Shift+X 结束');
    }

    // ========== 结束记录并汇总 ==========
    function stopRecording() {
        if (!recording) {
            showToast('当前没有在记录');
            console.log('[字幕记录] 当前没有在记录');
            return;
        }

        recording = false;

        if (observer) {
            observer.disconnect();
            observer = null;
        }

        if (captions.length === 0) {
            showToast('没有记录到任何字幕');
            console.log('[字幕记录] 没有记录到任何字幕');
            return;
        }

        const fullText = captions.join('\n');
        GM_setClipboard(fullText, 'text');

        console.log('[字幕记录] 已汇总并复制，共 ' + captions.length + ' 句');
        console.log('========== 完整字幕 ==========');
        console.log(fullText);
        console.log('==============================');

        showToast('已汇总并复制，共 ' + captions.length + ' 句');
        showResult(fullText);
    }

    // ========== 结果弹窗 ==========
    function showResult(text) {
        const old = document.getElementById('caption-result-overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'caption-result-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 70vw;
            max-height: 70vh;
            background: rgba(20,20,20,0.95);
            color: #fff;
            padding: 20px;
            border-radius: 10px;
            z-index: 99999;
            overflow-y: auto;
            font-size: 14px;
            line-height: 1.6;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;

        const title = document.createElement('div');
        title.textContent = '完整字幕（已复制到剪贴板）';
        title.style.cssText = 'font-weight: bold; margin-bottom: 10px; font-size: 16px;';

        const content = document.createElement('div');
        content.textContent = text;
        content.style.whiteSpace = 'pre-wrap';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        closeBtn.style.cssText = `
            margin-top: 15px;
            padding: 6px 16px;
            background: #f00;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;
        closeBtn.onclick = () => overlay.remove();

        overlay.appendChild(title);
        overlay.appendChild(content);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);
    }

    // ========== 最后一秒自动暂停 ==========
    function preventAutoplayNext() {
        const autoplayBtn = document.querySelector('.ytp-autonav-toggle-button');
        if (autoplayBtn && autoplayBtn.getAttribute('aria-checked') === 'true') {
            autoplayBtn.click();
            console.log('[字幕记录] 已关闭自动播放');
        }

        const video = document.querySelector('video');
        if (!video || video.dataset.captionHook) return;
        video.dataset.captionHook = '1';

        video.addEventListener('timeupdate', () => {
            if (!recording) return;

            const remain = video.duration - video.currentTime;
            if (remain <= 1 && !video.paused) {
                video.pause();
                console.log('[字幕记录] 已到最后一秒，自动暂停');
                showToast('已到最后一秒，自动暂停');
            }
        });
    }

    // ========== 快捷键 ==========
    document.addEventListener('keydown', function (e) {
        // Alt + Shift + S：开始
        if (e.altKey && e.shiftKey && !e.ctrlKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            e.stopPropagation();
            startRecording();
            preventAutoplayNext();
        }

        // Alt + Shift + X：结束（如果正在录制，先暂停视频）
        if (e.altKey && e.shiftKey && !e.ctrlKey && e.key.toLowerCase() === 'x') {
            e.preventDefault();
            e.stopPropagation();

            if (recording) {
                const video = document.querySelector('video');
                if (video && !video.paused) {
                    video.pause();
                    console.log('[字幕记录] 手动结束，已暂停视频');
                }
            }

            stopRecording();
        }
    }, true);

    // 页面切换视频时，如果正在记录，自动停止并汇总
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (recording) {
                console.log('[字幕记录] 检测到视频切换，自动停止并汇总');
                stopRecording();
            }
        }
    }).observe(document, { subtree: true, childList: true });

})();