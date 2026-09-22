// ==UserScript==
// @name         20260225-Instagram自动评论工具-有无后缀-windwos-中文繁体版-后台运行版-累积时间带tag
// @namespace    http://tampermonkey.net/
// @version      0.1.5
// @description  自动评论功能，支持最小化后台运行，新增“开始评论”按钮，修复时间叠加与评论重叠，新增按累积时间控制是否带后缀
// @author       Namtan
// @match        https://www.instagram.com/*
// @grant        none
// @name         Instagram Auto Commenter
// ...
// @updateURL   https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/instagram-commenter.user.js
// @downloadURL https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/instagram-commenter.user.js
// ==/UserScript==

(function () {
    'use strict';

    /* ---------- 样式（新增间隔输入行样式） ---------- */
    const style = document.createElement('style');
    style.textContent = `
         .ozx-config-btn {
                position: fixed;
                right: 20px;
                top: 70px;
                z-index: 9999;
                padding: 8px 16px;
                background: #1d9bf0;
                color: white;
                border: none;
                border-radius: 9999px;
                cursor: pointer;
                font-weight: bold;
                font-size: 14px;
            }
         .ozx-config-form {
                position: fixed;
                right: 20px;
                top: 130px;
                background: #ffffff;
                padding: 16px;
                border-radius: 16px;
                box-shadow: rgb(101 119 134 / 20%) 0px 0px 15px;
                z-index: 9999;
                width: 300px;
                display: none;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
            }

        .ozx-config-form textarea {
            width: 100%;
            margin-bottom: 12px;
            padding: 8px;
            border: 1px solid rgb(207, 217, 222);
            border-radius: 4px;
            font-size: 14px;
            resize: vertical;
            min-height: 80px;
            box-sizing: border-box;
        }

        .ozx-config-form label {
            display: block;
            margin-bottom: 6px;
            color: rgb(83, 100, 113);
            font-size: 13px;
            font-weight: 500;
        }

        .ozx-config-form button {
            background: #1d9bf0;
            color: white;
            border: none;
            border-radius: 9999px;
            padding: 8px 16px;
            font-weight: bold;
            cursor: pointer;
            font-size: 14px;
        }

        .ozx-start-btn {
            position: fixed;
            right: 20px;
            top: 150px;
            z-index: 9999;
            padding: 8px 16px;
            background: #17bf63;
            color: white;
            border: none;
            border-radius: 9999px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            display: none;
        }

        .ozx-status-indicator {
            position: fixed;
            right: 20px;
            top: 140px;
            z-index: 9999;
            padding: 6px 12px;
            background: #ffad1f;
            color: white;
            border: none;
            border-radius: 9999px;
            font-weight: bold;
            font-size: 12px;
            display: none;
        }

        /* 新增：间隔输入行样式 */
        .ozx-config-form .interval-tag-row {
            display: none; /* 默认隐藏 */
            margin-top: 8px;
        }
        .ozx-config-form .interval-tag-row input {
            width: 100%;
            padding: 8px;
            border: 1px solid rgb(207, 217, 222);
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
        }
    `;
    document.head.appendChild(style);

    /* ---------- 数据与状态 ---------- */
    let config = {
        comments: [],
        suffixes: [],
        commentInterval: 30,
        useSuffix: true,
        enableIntervalTag: false,    // 新增：是否启用间隔带tag
        intervalTagSeconds: 60        // 新增：间隔秒数
    };
    let currentArticle = null;
    let stopAuto = false;
    let isTerminated = true;

    // 后台运行相关状态
    let isBackgroundMode = false;
    let wakeLock = null;
    let audioContext = null;
    let visibilityCheckInterval = null;

    // 新增：记录上次重置时间（用于间隔判断）
    let lastResetTime = 0;

    /* ---------- 按钮 ---------- */
    const configBtn = document.createElement('button');
    configBtn.className = 'ozx-config-btn';
    configBtn.textContent = '一键互动';
    document.body.appendChild(configBtn);

    const form = document.createElement('div');
    form.className = 'ozx-config-form';
    form.innerHTML = `
        <label>评论内容（单个换行分隔不同评论,可少量）</label>
        <textarea id="comment-content" placeholder="输入评论内容...
保持单个换行会在评论中显示为换行"></textarea>

        <label>词条后缀（每行一个话题或关键词）</label>
        <textarea id="suffix-content" placeholder="#话题1
#话题2
#话题3"></textarea>
        <label>评论间隔（秒，默认30）</label>
        <input type="number" id="comment-interval" min="0" value="${config.commentInterval || 30}">
        <label style="display:flex;align-items:center;margin-top:8px;">
            <input type="checkbox" id="use-suffix-toggle" style="margin-right:6px;">
            使用后缀（关闭则仅输出评论）
        </label>

        <!-- 新增：按时间间隔带tag的选项 -->
        <label style="display:flex;align-items:center;margin-top:8px;">
            <input type="checkbox" id="enable-interval-tag" style="margin-right:6px;">
            按时间间隔带tag（需勾选“使用后缀”）
        </label>
        <div class="interval-tag-row" id="interval-tag-row">
            <label>间隔（秒）</label>
            <input type="number" id="interval-tag-seconds" min="1" value="60">
        </div>

        <label style="display:flex;align-items:center;margin-top:8px;">
            <input type="checkbox" id="background-mode-toggle" style="margin-right:6px;" checked>
            启用后台运行（最小化仍可继续）
        </label>
        <button id="save-config-btn">保存配置</button>
    `;
    document.body.appendChild(form);

    const startBtn = document.createElement('button');
    startBtn.className = 'ozx-start-btn';
    startBtn.textContent = '开始评论';
    document.body.appendChild(startBtn);

    const stopBtn = document.createElement('button');
    stopBtn.textContent = '停止评论';
    Object.assign(stopBtn.style, {
        position: 'fixed',
        top: '110px',
        right: '20px',
        zIndex: '9999',
        background: '#e0245e',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '9999px',
        cursor: 'pointer',
        display: 'none'
    });
    document.body.appendChild(stopBtn);

    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'ozx-status-indicator';
    statusIndicator.textContent = '后台运行中';
    document.body.appendChild(statusIndicator);

    /* ---------- 表单元素 ---------- */
    const formElements = {
        commentContent: () => document.getElementById('comment-content'),
        suffixContent: () => document.getElementById('suffix-content'),
        commentInterval: () => document.getElementById('comment-interval'),
        saveConfigBtn: () => document.getElementById('save-config-btn'),
        useSuffixToggle: () => document.getElementById('use-suffix-toggle'),
        enableIntervalTag: () => document.getElementById('enable-interval-tag'),
        intervalTagSeconds: () => document.getElementById('interval-tag-seconds'),
        intervalTagRow: () => document.getElementById('interval-tag-row'),
        backgroundModeToggle: () => document.getElementById('background-mode-toggle')
    };

    /* ---------- 监听复选框以显示/隐藏间隔输入框 ---------- */
    if (formElements.enableIntervalTag()) {
        formElements.enableIntervalTag().addEventListener('change', function(e) {
            const row = formElements.intervalTagRow();
            if (row) {
                row.style.display = e.target.checked ? 'block' : 'none';
            }
        });
    }

    /* ---------- 事件绑定 ---------- */
    configBtn.addEventListener('click', () => {
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
    });

    formElements.saveConfigBtn()?.addEventListener('click', () => {
        const commentContent = formElements.commentContent().value;
        const suffixContent = formElements.suffixContent().value;
        const commentInterval = parseInt(formElements.commentInterval().value, 10) || 30;
        const useSuffix = formElements.useSuffixToggle().checked;
        const enableIntervalTag = formElements.enableIntervalTag().checked;
        const intervalTagSeconds = parseInt(formElements.intervalTagSeconds().value, 10) || 60;
        const backgroundMode = formElements.backgroundModeToggle().checked;

        config.comments = commentContent.split(/\n\s*\n+/).map(c => c.trim()).filter(Boolean);
        config.suffixes = suffixContent.split('\n').map(s => s.trim()).filter(Boolean);
        config.commentInterval = commentInterval;
        config.useSuffix = useSuffix;
        config.enableIntervalTag = enableIntervalTag;
        config.intervalTagSeconds = intervalTagSeconds;
        config.backgroundMode = backgroundMode;

        localStorage.setItem('config', JSON.stringify(config));
        form.style.display = 'none';
        alert('配置已保存！点击“开始评论”即可启动。');
        startBtn.style.display = 'block';
    });

    /* ---------- 后台运行核心功能（与原代码一致，略作保留） ---------- */
    async function requestWakeLock() {
        if ('wakeLock' in navigator && config.backgroundMode) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('唤醒锁已激活');
                wakeLock.addEventListener('release', () => {
                    console.log('唤醒锁已释放');
                });
            } catch (err) {
                console.error('唤醒锁请求失败:', err);
            }
        }
    }

    function releaseWakeLock() {
        if (wakeLock) {
            wakeLock.release();
            wakeLock = null;
        }
    }

    function keepAudioContextAlive() {
        if (!config.backgroundMode) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0;
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start();
            setInterval(() => {
                if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }
            }, 30000);
            console.log('音频上下文已激活以保持后台运行');
        } catch (e) {
            console.error('音频上下文创建失败:', e);
        }
    }

    function startBackgroundKeepAlive() {
        if (visibilityCheckInterval) return;
        visibilityCheckInterval = setInterval(() => {
            const now = Date.now();
            // console.log('后台心跳:', now);
            window.dispatchEvent(new CustomEvent('backgroundTick', { detail: now }));
        }, 1000);
    }

    function stopBackgroundKeepAlive() {
        if (visibilityCheckInterval) {
            clearInterval(visibilityCheckInterval);
            visibilityCheckInterval = null;
        }
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            console.log('页面进入后台，切换至后台模式');
            isBackgroundMode = true;
            statusIndicator.style.display = 'block';
            statusIndicator.textContent = '后台运行中';
            statusIndicator.style.background = '#17bf63';
            if (config.backgroundMode) {
                requestWakeLock();
                keepAudioContextAlive();
                startBackgroundKeepAlive();
            }
        } else {
            console.log('页面回到前台');
            isBackgroundMode = false;
            statusIndicator.style.display = 'none';
            releaseWakeLock();
            stopBackgroundKeepAlive();
        }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    /* ---------- 工具函数 ---------- */
    function loadConfig() {
        const saved = localStorage.getItem('config');
        if (saved) try {
            config = JSON.parse(saved);
            if (config.backgroundMode === undefined) config.backgroundMode = true;
            if (config.enableIntervalTag === undefined) config.enableIntervalTag = false;
            if (config.intervalTagSeconds === undefined) config.intervalTagSeconds = 60;
        } catch (_) {}
        updateFormDisplay();
    }

    function updateFormDisplay() {
        formElements.commentContent().value = config.comments.join('\n\n');
        formElements.suffixContent().value  = config.suffixes.join('\n');
        formElements.commentInterval().value = config.commentInterval;
        formElements.useSuffixToggle().checked = config.useSuffix;
        if (formElements.enableIntervalTag()) {
            formElements.enableIntervalTag().checked = config.enableIntervalTag;
        }
        if (formElements.intervalTagSeconds()) {
            formElements.intervalTagSeconds().value = config.intervalTagSeconds;
        }
        if (formElements.backgroundModeToggle()) {
            formElements.backgroundModeToggle().checked = config.backgroundMode !== false;
        }
        // 根据 enableIntervalTag 状态显示/隐藏间隔输入行
        const row = formElements.intervalTagRow();
        if (row) {
            row.style.display = config.enableIntervalTag ? 'block' : 'none';
        }
    }

    const sleep = ms => new Promise(r => {
        if (config.backgroundMode && isBackgroundMode) {
            const start = Date.now();
            const check = () => {
                if (Date.now() - start >= ms) {
                    r();
                } else {
                    setTimeout(check, 100);
                }
            };
            setTimeout(check, 100);
        } else {
            setTimeout(r, ms);
        }
    });

    async function handleInteraction(article) {
        try { await addComment(article); }
        catch (e) { console.error(e); alert(e.message); }
    }

    async function addComment(article) {
        const editor = await waitForElement(document, 'textarea[placeholder="添加评论..."]', 10000);
        if (!editor) return console.warn('留言框未找到');
        highlightElement(editor, 'purple');

        // ----- 新增：根据间隔判断本次是否带后缀 -----
        let useSuffixNow = false;
        const now = Date.now();

        if (config.useSuffix) {
            if (config.enableIntervalTag) {
                // 间隔模式：如果从上一次重置到现在的时间 >= 设定间隔，则本次带tag，并重置计时
                const intervalMs = config.intervalTagSeconds * 1000;
                if (now - lastResetTime >= intervalMs) {
                    useSuffixNow = true;
                    lastResetTime = now; // 重置计时器
                } else {
                    useSuffixNow = false;
                }
            } else {
                // 未启用间隔，始终带tag
                useSuffixNow = true;
            }
        } else {
            useSuffixNow = false; // 用户关闭了后缀功能
        }

        // 根据useSuffixNow决定传入的后缀列表（若不带tag则传入空数组）
        const suffixesToUse = useSuffixNow ? config.suffixes : [];
        const text = getFormattedText(config.comments, suffixesToUse);
        console.log('需要输出的文案:', text);
        // ----- 结束新增逻辑 -----

        if (isBackgroundMode && config.backgroundMode) {
            await simulateTypingBackground(editor, text);
        } else {
            await simulateTypingWithErrors(editor, text, 100, 0);
        }

        const editor1 = await waitForElement(document, 'textarea[placeholder="添加评论..."]', 10000);
        if (!editor1) {
            console.warn('留言输入框1未找到，可能页面发生变化');
            return;
        } else {
            highlightElement(editor1, 'purple');
        }

        var elementsByTagName = editor1.nextElementSibling;
        var sendBtns = elementsByTagName.getElementsByTagName("div");

        let sendBtn = null;
        for (let i = 0; i < sendBtns.length; i++) {
            if (sendBtns[i].innerText === '发布' || sendBtns[i].textContent === '发布'  ||
                sendBtns[i].innerText === '發佈' || sendBtns[i].textContent === '發佈') {
                sendBtn = sendBtns[i];
                break;
            }
        }

        console.log('获取子节点-按钮:', sendBtn);
        if (sendBtn){
            await clickButton(sendBtn);
        } else {
            throw new Error('未找到发送按钮')
        }
    }

    async function simulateTypingBackground(el, txt) {
        el.focus();
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        nativeTextAreaValueSetter.call(el, txt);

        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));

        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));

        await sleep(500);
    }

    function getFormattedText(contents, suffixes) {
        if (!contents.length) return '';
        const body = contents[0].split('\n').map(l => l.trim()).filter(Boolean).join('\n');
        // 注意：这里使用 config.useSuffix 作为全局开关，但我们传入的 suffixes 可能为空数组
        // 如果 config.useSuffix 为 false，即使 suffixes 有内容也会返回 body（但这里 useSuffix 已在外部控制）
        if (!config.useSuffix || !suffixes.length) return body;
        const suffix = suffixes.map(l => l.trim()).filter(Boolean).join('\n');
        return `${body}\n\n${suffix}`;
    }

    async function clickButton(btn) {
        highlightElement(btn, 'green');

        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        btn.dispatchEvent(clickEvent);

        if (!clickEvent.defaultPrevented) {
            btn.click();
        }

        if (config.comments.length) {
            config.comments.shift();
            saveConfigAndRefreshForm();
        }
    }

    const saveConfigAndRefreshForm = (() => {
        let t; return () => { clearTimeout(t); t = setTimeout(() => {
            localStorage.setItem('config', JSON.stringify(config));
            updateFormDisplay();
        }, 10); };
    })();

    async function waitForElement(parent, selector, timeout = 10000) {
        const start = Date.now();
        const checkInterval = isBackgroundMode ? 500 : 120;

        while (Date.now() - start < timeout) {
            const el = parent.querySelector(selector);
            if (el) return el;
            await sleep(checkInterval);
        }
        throw new Error(`未找到 ${selector}`);
    }

    function highlightElement(el, color = 'red') {
        const old = el.style.cssText;
        el.style.cssText = `outline:3px solid ${color};outline-offset:2px`;
        setTimeout(() => el.style.cssText = old, 2000);
    }

    async function simulateTypingWithErrors(el, txt, speed, errRate) {
        el.focus();
        for (const ch of Array.from(txt)) {
            if (ch === '\n') {
                el.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
                document.execCommand('insertLineBreak');
                el.dispatchEvent(new KeyboardEvent('keyup', {key:'Enter', bubbles:true}));
            } else {
                document.execCommand('insertText', false, ch);
            }
            await sleep(speed + Math.random() * 100);
        }
    }

    /* ---------- 按钮事件 ---------- */
    stopBtn.addEventListener('click', () => {
        stopAuto = true;
        stopBtn.style.display = 'none';
        currentArticle = null;
        releaseWakeLock();
        stopBackgroundKeepAlive();
        alert('已停止自动评论');
    });

    startBtn.addEventListener('click', async () => {
        isTerminated = false;
        loadConfig();

        // 重置累积计时器（从上一次带tag开始计时，初始为开始时间）
        lastResetTime = Date.now();

        if (config.backgroundMode) {
            requestWakeLock();
            if (document.hidden) {
                isBackgroundMode = true;
                keepAudioContextAlive();
                startBackgroundKeepAlive();
            }
        }

        if (!config.comments.length) return alert('请先在配置中添加评论内容！');
        const art = document.querySelector('article');
        if (!art) return alert('找不到帖子，请打开任意帖子后再试。');

        currentArticle = art;
        stopAuto = false;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';

        if (config.backgroundMode) {
            statusIndicator.style.display = 'block';
        }

        while (currentArticle && config.comments.length && !stopAuto) {
            await handleInteraction(currentArticle);

            const base = config.commentInterval * 1000;
            const delay = base  + Math.random() * 20000;
            const safe = Math.max(5000, delay);
            console.log(`下次评论 ${Math.round(safe / 1000)} 秒后`);

            await sleep(safe);
        }

        if (!config.comments.length) alert('评论内容已用完！');
        stopBtn.style.display = 'none';
        startBtn.style.display = 'block';
        statusIndicator.style.display = 'none';
        currentArticle = null;
        stopAuto = false;

        releaseWakeLock();
        stopBackgroundKeepAlive();
    });

    window.addEventListener('beforeunload', () => {
        releaseWakeLock();
        stopBackgroundKeepAlive();
    });

    loadConfig();
})();
