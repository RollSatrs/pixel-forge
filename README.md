# PixelForge

Десктопное приложение на Electron для генерации пиксельных спрайтов для 2D игр (Godot, Unity и т.д.) по текстовому описанию на русском языке.

Два режима генерации:
- **Stable Diffusion** — локально через AUTOMATIC1111 / ComfyUI API.
- **Gemini** — онлайн через Google Gemini API (`gemini-2.0-flash`), генерирует SVG пиксель-арт.

---

## 1. Установка Node.js

### Mac (M1/M2/M3)

1. Установите [Homebrew](https://brew.sh), если его ещё нет:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. Установите Node.js (LTS, версия 18+):
   ```bash
   brew install node
   ```
3. Проверьте версию:
   ```bash
   node -v
   npm -v
   ```

### Windows

1. Скачайте установщик Node.js LTS с [nodejs.org](https://nodejs.org) (кнопка "LTS").
2. Запустите установщик, оставьте настройки по умолчанию.
3. Проверьте в PowerShell или CMD:
   ```powershell
   node -v
   npm -v
   ```

---

## 2. Установка зависимостей проекта

В папке проекта `pixel-forge`:

```bash
npm install
```

Это установит Electron, electron-builder и electron-store.

---

## 3. Как получить бесплатный Gemini API ключ

1. Перейдите на [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Войдите под своим Google-аккаунтом.
3. Нажмите **Create API key** (или **Get API key** → **Create API key in new project**).
4. Скопируйте ключ вида `AIza...`.
5. Вставьте его в поле **"Gemini API ключ"** в левой панели приложения при выборе режима Gemini — ключ сохранится локально на компьютере через `electron-store` (файл конфигурации в стандартной пользовательской директории приложения, не хранится онлайн).

Бесплатный лимит Gemini API на момент написания — достаточен для тестовой генерации спрайтов без привязки карты.

---

## 4. Установка Stable Diffusion (AUTOMATIC1111) на Windows с RTX 3060

### Самый быстрый способ — quickstart (почти без вопросов)

Если не хочется отвечать на пошаговые вопросы мастера — есть скрипт, который делает всё сам одной командой: ставит Python 3.10 и Git (тихо, без окон), клонирует AUTOMATIC1111, чинит все известные баги совместимости, запускает WebUI и сам PixelForge.

1. Скачайте pixel-art модель с [civitai.com](https://civitai.com/models/34/all-in-one-pixel-model) (тип **Checkpoint**, база **SD1**) — это единственный шаг, который нельзя автоматизировать, Civitai требует вход в аккаунт для скачивания.
2. Перетащите скачанный файл модели прямо на `scripts/quickstart.bat` (или просто дважды кликните по нему без модели — добавите её потом).
3. Откроется окно, которое само поставит недостающее, настроит и запустит всё — WebUI и PixelForge откроются сами.

Если у вас нет Node.js — сначала выполните шаги ниже ("Как получить..." → пункт с Node.js), либо `winget install OpenJS.NodeJS.LTS`.

Под капотом `scripts/quickstart.bat` просто запускает `scripts/quickstart.ps1` (PowerShell) — можно открыть и посмотреть, что именно он делает, или передать свой путь к модели вручную:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\quickstart.ps1 -ModelPath "C:\путь\к\модели.safetensors"
```

### Пошаговый мастер (с объяснениями на русском/английском)

Если хочется понимать каждый шаг, а не просто "запустил и жди" — используйте интерактивный мастер `scripts/setup-stable-diffusion.sh` (раздел ниже, "Windows — автоматический мастер настройки"). Он спрашивает язык, объясняет каждый шаг и просит подтверждения.

### Вручную, по одному шагу

1. **Установите Python 3.10.x** — скачайте с [python.org](https://www.python.org/downloads/release/python-31011/) (важно: версия 3.10, не 3.11+). При установке отметьте галочку **"Add Python to PATH"**.

2. **Установите Git** — скачайте с [git-scm.com](https://git-scm.com/download/win) и установите с настройками по умолчанию.

3. **Установите драйверы NVIDIA** — убедитесь, что установлена последняя версия драйвера для RTX 3060 через [NVIDIA GeForce Experience](https://www.nvidia.com/en-us/geforce/geforce-experience/) или сайт NVIDIA.

4. **Склонируйте репозиторий AUTOMATIC1111**:
   ```powershell
   git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
   cd stable-diffusion-webui
   ```

5. **Скачайте модель для пиксель-арта**. Рекомендуемые варианты (бесплатные, на Hugging Face / CivitAI):
   - `PixelArt Redmond` (LoRA)
   - `All-In-One-Pixel-Model`
   - Или любая модель с тегом `pixel-art` на [civitai.com](https://civitai.com) (поиск "pixel art model").

   Положите скачанный `.safetensors` файл модели в папку:
   ```
   stable-diffusion-webui\models\Stable-diffusion\
   ```

6. **Включите режим API и доступ по сети**. Откройте файл `webui-user.bat` и добавьте флаги в переменную запуска:
   ```bat
   set COMMANDLINE_ARGS=--api --xformers --listen
   ```
   - `--api` — обязателен, без него PixelForge не сможет обращаться к серверу вообще.
   - `--xformers` — ускоряет генерацию на RTX-картах (опционально, но рекомендуется).
   - `--listen` — нужен **только если PixelForge будет запущен на другом устройстве** (например, на Mac), а не на этом же Windows-компьютере. Без `--listen` сервер отвечает только на запросы с самого себя (`localhost`) и с других устройств в сети его не видно.

   > ⚠️ `--listen` открывает сервер для любого устройства в вашей домашней сети без пароля. Используйте это только в доверенной домашней сети, не в публичном/офисном Wi-Fi.

7. **Запустите WebUI**:
   ```powershell
   webui-user.bat
   ```
   Первый запуск скачает дополнительные зависимости — это может занять 10-20 минут. После запуска в консоли появится строка вида `Running on local URL: http://0.0.0.0:7860` (если указан `--listen`) — это значит сервер слушает не только себя, а всю сеть.

8. **Узнайте локальный IP-адрес Windows-компьютера** (если PixelForge будет на другом устройстве). В командной строке Windows:
   ```powershell
   ipconfig
   ```
   Найдите строку **IPv4-адрес** под своим Wi-Fi/Ethernet-адаптером — она выглядит как `192.168.1.50`. Это адрес, который нужно будет вписать в PixelForge вместо `localhost`.

9. **Настройте Windows Firewall**, если подключение с другого устройства не проходит: Панель управления → Windows Defender Firewall → Дополнительные параметры → Правила для входящих подключений → создать правило для порта **TCP 7860** (разрешить).

### Известная проблема: `Stability-AI/stablediffusion.git` не найден (404)

Это баг самого AUTOMATIC1111, не нашего проекта: Stability AI удалили/скрыли репозиторий, который webui клонирует внутри себя при первой установке. Подтверждено в issue [#17204](https://github.com/AUTOMATIC1111/stable-diffusion-webui/issues/17204) и обсуждении [#17212](https://github.com/AUTOMATIC1111/stable-diffusion-webui/discussions/17212).

**Скрипт-мастер (`scripts/setup-stable-diffusion.sh`) чинит это автоматически** — правит `modules/launch_utils.py`, чтобы использовать рабочее зеркало `w-e-w/stablediffusion`, и следит, чтобы стоял именно Python 3.10 (а не более новый), для которого у `torch==2.1.2` есть готовые сборки.

Если вы уже успели что-то сломать вручную (например, поменяли `torch==2.1.2` на `2.9.0` в `requirements_versions.txt`, пытаясь обойти ошибку) — **откатите эти правки** (`git checkout requirements_versions.txt` в папке webui) и вместо этого:

1. Убедитесь, что установлен именно Python 3.10.x (не 3.11+, не 3.14) — `py -3.10 --version` в PowerShell.
2. В `webui-user.bat` добавьте строку с точным путём к 3.10, например:
   ```bat
   set PYTHON=C:\Users\ВЫ\AppData\Local\Programs\Python\Python310\python.exe
   ```
3. В `modules/launch_utils.py` замените:
   ```python
   "https://github.com/Stability-AI/stablediffusion.git"
   ```
   на:
   ```python
   "https://github.com/w-e-w/stablediffusion.git"
   ```
4. Удалите папки `repositories\stable-diffusion-stability-ai` и `venv` внутри `stable-diffusion-webui` (чтобы всё пересобралось с нуля с правильным Python и torch).
5. Запустите `webui-user.bat` заново.

### Как подключить PixelForge к Windows по сети

В левой панели PixelForge есть поле **"Адрес Stable Diffusion"**:
- Если PixelForge и Stable Diffusion работают **на одном и том же компьютере** — оставьте `http://localhost:7860`.
- Если Stable Diffusion работает **на Windows-компьютере, а PixelForge — на другом устройстве** (например, Mac) — впишите туда IP-адрес Windows-машины из шага 8, например `http://192.168.1.50:7860`.

Нажмите кнопку **"Проверить"** рядом с полем — индикатор станет зелёным, если сервер отвечает, и красным с описанием ошибки, если нет. Проверка также выполняется автоматически при переключении в режим Stable Diffusion.

8. **Выберите модель пиксель-арта** в выпадающем списке "Stable Diffusion checkpoint" в верхней части интерфейса WebUI.

9. Убедитесь, что WebUI запущен и работает **перед** тем как использовать режим "Stable Diffusion" в PixelForge — приложение обращается к `http://localhost:7860` напрямую.

### Windows — автоматический мастер настройки

Вместо ручного прохождения шагов 1-9 выше можно запустить готовый скрипт-мастер, который сам проведёт по каждому шагу, откроет нужные страницы в браузере, склонирует репозиторий, включит флаг `--api`, поможет скачать pixel-art модель и проверит что API отвечает и что PixelForge реально генерирует спрайт:

1. Установите [Git for Windows](https://git-scm.com/download/win) (даёт Git Bash — терминал для запуска скрипта).
2. Откройте **Git Bash** и перейдите в папку проекта:
   ```bash
   cd /c/путь/до/pixel-forge
   ```
3. Запустите мастер:
   ```bash
   bash scripts/setup-stable-diffusion.sh
   ```
4. Первым делом мастер спросит язык — **[1] Русский** или **[2] English** (по умолчанию русский, просто нажмите Enter). Весь дальнейший текст в терминале будет на выбранном языке.
5. Следуйте подсказкам на экране — мастер сам скажет что скачать, где кликнуть и что скопировать, автоматически исправит известные проблемы совместимости AUTOMATIC1111 (см. ниже), и в конце протестирует генерацию прямо в PixelForge.

Скрипт можно останавливать в любой момент (`Ctrl+C`) и запускать заново — он помнит уже введённые значения (файл `.sd-setup.env` в папке проекта).

### Mac (M1)

AUTOMATIC1111 тоже работает на Apple Silicon, но заметно медленнее (используется CPU/MPS, а не CUDA):

```bash
brew install cmake protobuf rust python@3.10 git
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
cd stable-diffusion-webui
./webui.sh --api
```

Для Mac рекомендуется использовать режим **Gemini** как основной — он быстрее и не требует GPU.

---

## 5. Запуск приложения

```bash
npm start
```

Откроется окно PixelForge (минимальный размер 1200x700, окно можно ресайзить).

**Быстрая генерация**: `Ctrl+Enter` (или `Cmd+Enter` на Mac) в любом месте окна запускает генерацию.

---

## 6. Сборка дистрибутива

Собрать `.app` для Mac и `.exe` для Windows (кросс-сборка требует соответствующей ОС или дополнительной настройки — обычно собирают на своей платформе):

```bash
# Собрать под текущую ОС
npm run build

# Только Mac (.dmg / .zip)
npm run build:mac

# Только Windows (.exe / portable)
npm run build:win
```

Готовые файлы появятся в папке `dist/`.

> Примечание: сборка `.exe` на Mac и `.app` на Windows без дополнительных инструментов (Wine, кросс-компиляция) может не работать "из коробки" — рекомендуется собирать каждую версию на соответствующей ОС или использовать CI (GitHub Actions).

---

## Структура проекта

```
pixel-forge/
├── package.json     — зависимости и скрипты сборки
├── main.js          — главный процесс Electron, IPC, обращения к API
├── preload.js       — безопасный мост между main и renderer
├── index.html       — интерфейс (три колонки)
├── styles.css       — все стили (тёмная тема)
├── renderer.js      — логика генерации, референсов, истории
└── README.md        — этот файл
```

## Где хранятся данные

- API ключи (Gemini, Unsplash) и история из 12 последних генераций сохраняются локально через `electron-store` в стандартной пользовательской папке приложения:
  - Mac: `~/Library/Application Support/pixel-forge/`
  - Windows: `%APPDATA%\pixel-forge\`
