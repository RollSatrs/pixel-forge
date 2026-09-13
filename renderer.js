(function () {
  'use strict';

  const state = {
    mode: 'sd', // 'sd' | 'gemini'
    size: 32,
    zoom: 2,
    lastPrompt: '',
    current: null, // { type: 'png'|'svg', dataUrl, svgText }
    history: [],
    refProvider: 'unsplash'
  };

  const el = {
    modeSwitch: document.getElementById('modeSwitch'),
    geminiKeyField: document.getElementById('geminiKeyField'),
    sdServerField: document.getElementById('sdServerField'),
    geminiApiKey: document.getElementById('geminiApiKey'),
    description: document.getElementById('description'),
    sizeGroup: document.getElementById('sizeGroup'),
    style: document.getElementById('style'),
    palette: document.getElementById('palette'),
    generateBtn: document.getElementById('generateBtn'),
    status: document.getElementById('status'),
    zoomGroup: document.getElementById('zoomGroup'),
    canvasStage: document.getElementById('canvasStage'),
    canvasPlaceholder: document.getElementById('canvasPlaceholder'),
    resultImage: document.getElementById('resultImage'),
    downloadPngBtn: document.getElementById('downloadPngBtn'),
    downloadSvgBtn: document.getElementById('downloadSvgBtn'),
    copyCodeBtn: document.getElementById('copyCodeBtn'),
    historyList: document.getElementById('historyList'),
    refGrid: document.getElementById('refGrid'),
    refreshRefsBtn: document.getElementById('refreshRefsBtn'),
    unsplashApiKey: document.getElementById('unsplashApiKey'),
    sdServerUrl: document.getElementById('sdServerUrl'),
    checkConnectionBtn: document.getElementById('checkConnectionBtn'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    refModal: document.getElementById('refModal'),
    refModalImage: document.getElementById('refModalImage'),
    refModalClose: document.getElementById('refModalClose')
  };

  const SD_BASE_PROMPT = (size, description) =>
    `pixel art, ${size}x${size} sprite, 2d game asset, clean pixels, transparent background, ${description}`;
  const SD_NEGATIVE_PROMPT =
    'blurry, realistic, 3d, gradient, anti-aliasing, smooth';

  // ---------- Init ----------

  async function init() {
    const savedMode = await window.pixelForge.store.get('mode');
    if (savedMode) setMode(savedMode);

    const savedKey = await window.pixelForge.store.get('geminiApiKey');
    if (savedKey) el.geminiApiKey.value = savedKey;

    const savedUnsplashKey = await window.pixelForge.store.get('unsplashApiKey');
    if (savedUnsplashKey) el.unsplashApiKey.value = savedUnsplashKey;

    const savedServerUrl = await window.pixelForge.store.get('sdServerUrl');
    el.sdServerUrl.value = savedServerUrl || 'http://localhost:7860';

    const savedHistory = await window.pixelForge.store.get('history');
    state.history = Array.isArray(savedHistory) ? savedHistory : [];
    renderHistory();

    bindEvents();

    if (state.mode === 'sd') checkConnection();
  }

  function bindEvents() {
    el.modeSwitch.addEventListener('click', (e) => {
      const btn = e.target.closest('.mode-btn');
      if (!btn) return;
      setMode(btn.dataset.mode);
    });

    el.geminiApiKey.addEventListener('change', () => {
      window.pixelForge.store.set('geminiApiKey', el.geminiApiKey.value);
    });

    el.unsplashApiKey.addEventListener('change', () => {
      window.pixelForge.store.set('unsplashApiKey', el.unsplashApiKey.value);
    });

    el.sdServerUrl.addEventListener('change', () => {
      window.pixelForge.store.set('sdServerUrl', el.sdServerUrl.value.trim());
      setConnectionStatus('idle', 'Не проверено');
    });

    el.checkConnectionBtn.addEventListener('click', checkConnection);

    el.sizeGroup.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      [...el.sizeGroup.children].forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.size = parseInt(chip.dataset.value, 10);
    });

    el.zoomGroup.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      [...el.zoomGroup.children].forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.zoom = parseInt(chip.dataset.zoom, 10);
      applyZoom();
    });

    el.generateBtn.addEventListener('click', generate);

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        generate();
      }
    });

    el.downloadPngBtn.addEventListener('click', downloadPng);
    el.downloadSvgBtn.addEventListener('click', downloadSvg);
    el.copyCodeBtn.addEventListener('click', copyCode);

    el.refreshRefsBtn.addEventListener('click', loadReferences);

    el.refModalClose.addEventListener('click', closeRefModal);
    el.refModal.querySelector('.modal-backdrop').addEventListener('click', closeRefModal);
  }

  function setMode(mode) {
    state.mode = mode;
    [...el.modeSwitch.children].forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    el.geminiKeyField.style.display = mode === 'gemini' ? 'flex' : 'none';
    el.sdServerField.style.display = mode === 'sd' ? 'flex' : 'none';
    window.pixelForge.store.set('mode', mode);
    if (mode === 'sd') checkConnection();
  }

  function setStatus(text, type) {
    el.status.textContent = text || '';
    el.status.className = 'status' + (type ? ' ' + type : '');
  }

  function setConnectionStatus(kind, text) {
    el.statusDot.className = 'status-dot' + (kind === 'idle' ? '' : ' ' + kind);
    el.statusText.textContent = text;
  }

  async function checkConnection() {
    const serverUrl = el.sdServerUrl.value.trim();
    setConnectionStatus('checking', 'Проверка...');
    el.checkConnectionBtn.disabled = true;
    try {
      const result = await window.pixelForge.checkStableDiffusionConnection({ serverUrl });
      if (result.ok) {
        setConnectionStatus('online', `В сети (моделей: ${result.modelCount})`);
      } else {
        setConnectionStatus('offline', result.error || 'Недоступен');
      }
    } catch (err) {
      setConnectionStatus('offline', err.message || 'Недоступен');
    } finally {
      el.checkConnectionBtn.disabled = false;
    }
  }

  // ---------- Generation ----------

  async function generate() {
    const description = el.description.value.trim();
    if (!description) {
      setStatus('Введите описание спрайта', 'error');
      return;
    }

    el.generateBtn.disabled = true;
    setStatus('Генерация...', '');

    try {
      if (state.mode === 'sd') {
        await generateWithStableDiffusion(description);
      } else {
        await generateWithGemini(description);
      }
      setStatus('Готово!', 'success');
      loadReferences();
    } catch (err) {
      console.error(err);
      setStatus(err.message || 'Ошибка генерации', 'error');
    } finally {
      el.generateBtn.disabled = false;
    }
  }

  async function generateWithStableDiffusion(description) {
    const prompt = SD_BASE_PROMPT(state.size, description);
    state.lastPrompt = prompt;

    const result = await window.pixelForge.generateStableDiffusion({
      prompt,
      negativePrompt: SD_NEGATIVE_PROMPT,
      width: state.size,
      height: state.size,
      serverUrl: el.sdServerUrl.value.trim()
    });

    const dataUrl = `data:image/png;base64,${result.base64}`;
    setResult({ type: 'png', dataUrl, prompt });
  }

  async function generateWithGemini(description) {
    const apiKey = el.geminiApiKey.value.trim();
    if (!apiKey) {
      throw new Error('Введите Gemini API ключ');
    }

    const result = await window.pixelForge.generateGemini({
      apiKey,
      description,
      size: state.size,
      style: el.style.value,
      palette: el.palette.value
    });

    const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(result.svg)))}`;
    setResult({ type: 'svg', dataUrl: svgDataUrl, svgText: result.svg });
  }

  function setResult(payload) {
    state.current = payload;

    el.canvasPlaceholder.style.display = 'none';
    el.resultImage.style.display = 'block';
    el.resultImage.src = payload.dataUrl;

    applyZoom();

    el.downloadPngBtn.disabled = false;
    el.downloadSvgBtn.disabled = payload.type !== 'svg';
    el.copyCodeBtn.disabled = false;

    addToHistory(payload);
  }

  function applyZoom() {
    const base = state.size;
    const px = base * state.zoom;
    el.resultImage.style.width = px + 'px';
    el.resultImage.style.height = px + 'px';
  }

  // ---------- History ----------

  function addToHistory(payload) {
    state.history.unshift({
      dataUrl: payload.dataUrl,
      type: payload.type,
      svgText: payload.svgText || null,
      prompt: payload.prompt || null,
      size: state.size
    });
    state.history = state.history.slice(0, 12);
    window.pixelForge.store.set('history', state.history);
    renderHistory();
  }

  function renderHistory() {
    el.historyList.innerHTML = '';
    state.history.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'history-item';
      const img = document.createElement('img');
      img.src = item.dataUrl;
      div.appendChild(img);
      div.addEventListener('click', () => {
        state.size = item.size || state.size;
        setResult({
          type: item.type,
          dataUrl: item.dataUrl,
          svgText: item.svgText,
          prompt: item.prompt
        });
      });
      el.historyList.appendChild(div);
    });
  }

  // ---------- Downloads ----------

  function triggerDownload(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function downloadPng() {
    if (!state.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const img = new Image();
    img.src = state.current.dataUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    ctx.clearRect(0, 0, 512, 512);
    ctx.drawImage(img, 0, 0, 512, 512);

    const pngDataUrl = canvas.toDataURL('image/png');
    triggerDownload(pngDataUrl, 'sprite-512.png');
  }

  function downloadSvg() {
    if (!state.current || state.current.type !== 'svg') return;
    const blob = new Blob([state.current.svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'sprite.svg');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function copyCode() {
    if (!state.current) return;
    const text =
      state.current.type === 'svg'
        ? state.current.svgText
        : state.current.prompt || '';
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Скопировано в буфер обмена', 'success');
    } catch (err) {
      setStatus('Не удалось скопировать', 'error');
    }
  }

  // ---------- References ----------

  async function loadReferences() {
    const description = el.description.value.trim();
    if (!description) {
      el.refGrid.innerHTML = '<div class="ref-empty">Введите описание слева, чтобы найти референсы</div>';
      return;
    }

    let apiKey = el.unsplashApiKey.value.trim();
    let provider = 'unsplash';
    if (!apiKey) {
      apiKey = await window.pixelForge.store.get('pixabayApiKey');
      provider = 'pixabay';
    }

    if (!apiKey) {
      el.refGrid.innerHTML =
        '<div class="ref-empty">Введите Unsplash API ключ выше, чтобы искать референсы</div>';
      return;
    }

    el.refGrid.innerHTML = '<div class="ref-empty">Загрузка референсов...</div>';

    try {
      const results = await window.pixelForge.searchReferences({
        query: description,
        provider,
        apiKey
      });
      renderReferences(results);
    } catch (err) {
      console.error(err);
      el.refGrid.innerHTML = `<div class="ref-empty">Ошибка загрузки: ${err.message}</div>`;
    }
  }

  function renderReferences(results) {
    el.refGrid.innerHTML = '';
    if (!results.length) {
      el.refGrid.innerHTML = '<div class="ref-empty">Ничего не найдено</div>';
      return;
    }
    results.forEach((r) => {
      const div = document.createElement('div');
      div.className = 'ref-item';
      const img = document.createElement('img');
      img.src = r.thumb;
      img.loading = 'lazy';
      div.appendChild(img);
      div.addEventListener('click', () => openRefModal(r.full));
      el.refGrid.appendChild(div);
    });
  }

  function openRefModal(src) {
    el.refModalImage.src = src;
    el.refModal.classList.add('open');
  }

  function closeRefModal() {
    el.refModal.classList.remove('open');
    el.refModalImage.src = '';
  }

  init();
})();
