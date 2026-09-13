const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store({
  name: 'pixel-forge-config',
  defaults: {
    geminiApiKey: '',
    unsplashApiKey: '',
    pixabayApiKey: '',
    mode: 'gemini',
    history: []
  }
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0d0d1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- Store IPC ----------

ipcMain.handle('store:get', (_event, key) => store.get(key));
ipcMain.handle('store:set', (_event, key, value) => store.set(key, value));

// ---------- Stable Diffusion (AUTOMATIC1111) ----------

function normalizeServerUrl(serverUrl) {
  const trimmed = (serverUrl || 'http://localhost:7860').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

ipcMain.handle('sd:check-connection', async (_event, params) => {
  const base = normalizeServerUrl(params && params.serverUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${base}/sdapi/v1/sd-models`, {
      signal: controller.signal
    });
    if (!response.ok) {
      return { ok: false, error: `Сервер ответил с ошибкой ${response.status}` };
    }
    const models = await response.json();
    return { ok: true, modelCount: Array.isArray(models) ? models.length : 0 };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Нет ответа за 5 секунд — проверьте что WebUI запущен и адрес верный' };
    }
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
});

ipcMain.handle('generate:stable-diffusion', async (_event, params) => {
  const { prompt, negativePrompt, width, height, serverUrl } = params;
  const url = `${normalizeServerUrl(serverUrl)}/sdapi/v1/txt2img`;

  const body = {
    prompt,
    negative_prompt: negativePrompt,
    width,
    height,
    steps: 25,
    cfg_scale: 7,
    sampler_name: 'Euler a',
    batch_size: 1,
    n_iter: 1
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AUTOMATIC1111 API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  if (!data.images || !data.images[0]) {
    throw new Error('AUTOMATIC1111 не вернул изображение');
  }

  return { type: 'png', base64: data.images[0] };
});

// ---------- Gemini ----------

const GEMINI_SYSTEM_PROMPT = `Ты эксперт по пиксельной графике для 2D игр. Создавай SVG где каждый пиксель это <rect width='1' height='1'/>. viewBox '0 0 32 32'. Только SVG код без текста. Тёмный контур обязателен. Фон прозрачный. Объект занимает 70% холста.`;

ipcMain.handle('generate:gemini', async (_event, params) => {
  const { apiKey, description, size, style, palette } = params;

  if (!apiKey) {
    throw new Error('Не указан Gemini API ключ');
  }

  const userPrompt = `${GEMINI_SYSTEM_PROMPT}\n\nОписание объекта: ${description}\nРазмер спрайта: ${size}x${size}\nСтиль: ${style}\nПалитра: ${palette}\nViewBox должен быть '0 0 ${size} ${size}'.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: userPrompt }] }]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini не вернул текст ответа');
  }

  const match = text.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) {
    throw new Error('Не удалось извлечь SVG из ответа Gemini');
  }

  return { type: 'svg', svg: match[0] };
});

// ---------- References (Unsplash / Pixabay) ----------

ipcMain.handle('references:search', async (_event, params) => {
  const { query, provider, apiKey } = params;
  const searchQuery = `${query} pixel art sprite`;

  if (provider === 'pixabay') {
    const url = `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(searchQuery)}&image_type=illustration&per_page=6`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Pixabay API error (${response.status})`);
    const data = await response.json();
    return (data.hits || []).slice(0, 6).map((hit) => ({
      thumb: hit.webformatURL,
      full: hit.largeImageURL,
      link: hit.pageURL
    }));
  }

  // default: Unsplash
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=6&client_id=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unsplash API error (${response.status})`);
  const data = await response.json();
  return (data.results || []).slice(0, 6).map((r) => ({
    thumb: r.urls.thumb,
    full: r.urls.regular,
    link: r.links.html
  }));
});
