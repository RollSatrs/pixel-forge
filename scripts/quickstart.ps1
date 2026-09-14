#Requires -Version 5.0
<#
  Одна команда — ставит Python 3.10, Git, AUTOMATIC1111, чинит известные баги
  совместимости, копирует модель (если путь передан), запускает WebUI и
  PixelForge. Почти без вопросов — предполагает что вы уже скачали модель
  с civitai.com (это единственный шаг, который нельзя автоматизировать
  без входа в аккаунт).

  Использование:
    powershell -ExecutionPolicy Bypass -File quickstart.ps1
    powershell -ExecutionPolicy Bypass -File quickstart.ps1 -ModelPath "C:\...\model.safetensors"

  Проще: используйте quickstart.bat рядом — можно перетащить файл модели
  прямо на его иконку, либо просто дважды кликнуть без модели.
#>

param(
  [string]$ModelPath = "",
  [string]$InstallDir = "$env:USERPROFILE\stable-diffusion-webui",
  [string]$PixelForgeDir = $(Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

function Say($text)  { Write-Host "  $text" }
function Step($text) { Write-Host "  > $text" -ForegroundColor Cyan }
function Note($text) { Write-Host "  $text" -ForegroundColor DarkGray }
function Warn($text) { Write-Host "  ! $text" -ForegroundColor Yellow }
function Ok($text)   { Write-Host "  OK: $text" -ForegroundColor Green }
function Fail($text) { Write-Host "  ОШИБКА: $text" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=== PixelForge quickstart — автоматическая установка Stable Diffusion ===" -ForegroundColor Blue
Write-Host ""

# ── 1. winget ────────────────────────────────────────────────────────────
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Fail "winget не найден. Обновите 'App Installer' из Microsoft Store, затем запустите скрипт снова."
}

# ── 2. Python 3.10 (устанавливаем молча, если нет) ─────────────────────────
Step "Проверяю Python 3.10..."
$python310 = $null
try { $python310 = (& py -3.10 -c "import sys; print(sys.executable)" 2>$null) } catch {}

if (-not $python310) {
  Step "Ставлю Python 3.10 автоматически (тихая установка, без окон и вопросов)..."
  winget install --id Python.Python.3.10 -e --silent --accept-package-agreements --accept-source-agreements | Out-Null
  try { $python310 = (& py -3.10 -c "import sys; print(sys.executable)" 2>$null) } catch {}
}
if ($python310) { Ok "Python 3.10: $python310" } else { Fail "Не удалось поставить Python 3.10 автоматически. Поставьте вручную с python.org (галочка 'Add to PATH') и запустите скрипт снова." }

# ── 3. Git ───────────────────────────────────────────────────────────────
Step "Проверяю Git..."
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Step "Ставлю Git автоматически..."
  winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements | Out-Null
  $env:Path = "$env:Path;$env:ProgramFiles\Git\cmd"
}
if (Get-Command git -ErrorAction SilentlyContinue) { Ok "Git: $(git --version)" } else { Fail "Git не найден после установки — откройте новое окно терминала и запустите скрипт снова." }

# ── 4. Клонирование AUTOMATIC1111 ──────────────────────────────────────────
if (Test-Path (Join-Path $InstallDir ".git")) {
  Ok "stable-diffusion-webui уже есть в $InstallDir"
} else {
  Step "Клонирую AUTOMATIC1111/stable-diffusion-webui в $InstallDir ..."
  git clone --quiet https://github.com/AUTOMATIC1111/stable-diffusion-webui.git $InstallDir
  Ok "Склонировано."
}

# ── 5. Настройка webui-user.bat (--api --listen, точный Python 3.10) ──────
$webuiUserBat = Join-Path $InstallDir "webui-user.bat"
if (-not (Test-Path $webuiUserBat)) { Fail "Не найден $webuiUserBat — клонирование могло завершиться с ошибкой." }

$content = Get-Content $webuiUserBat
if ($content -match '^set COMMANDLINE_ARGS=') {
  $content = $content -replace '^set COMMANDLINE_ARGS=.*', 'set COMMANDLINE_ARGS=--api --xformers --listen'
} else {
  $content += "set COMMANDLINE_ARGS=--api --xformers --listen"
}
if ($content -match '^set PYTHON=') {
  $content = $content -replace '^set PYTHON=.*', "set PYTHON=$python310"
} else {
  $content += "set PYTHON=$python310"
}
$content | Set-Content $webuiUserBat
Ok "webui-user.bat настроен: --api --xformers --listen, PYTHON=$python310"

# ── 6a. Фикс "No module named 'pkg_resources'" при установке CLIP ─────────
# Известный баг с февраля 2026: setuptools 82+ убрали pkg_resources, а старые
# пакеты (openai/CLIP, open_clip и похожие) всё ещё его требуют при сборке из
# исходников. https://github.com/AUTOMATIC1111/stable-diffusion-webui/discussions/17276
#
# Фикс из двух частей:
#  1. Закрепить в venv старую setuptools (69.5.1).
#  2. Пропатчить launch_utils.py, чтобы его pip install для этих пакетов
#     использовал --no-build-isolation — тогда сборка берёт закреплённую
#     версию из venv вместо свежей (сломанной), которую pip иначе скачал бы
#     в отдельное временное окружение сборки.
#     (Переменная окружения PIP_NO_BUILD_ISOLATION НЕ работает надёжно — pip
#     не поддерживает --no-build-isolation как настройку через env var,
#     подтверждено: пользователи всё равно попадают в изолированное окружение
#     сборки даже с этой переменной выставленной.)
$venvDir = Join-Path $InstallDir "venv"
if (-not (Test-Path $venvDir)) {
  Step "Создаю venv (виртуальное окружение) с Python 3.10..."
  & $python310 -m venv $venvDir
}
$venvPython = Join-Path $venvDir "Scripts\python.exe"
if (Test-Path $venvPython) {
  Step "Закрепляю setuptools==69.5.1 в venv (чинит ошибку 'No module named pkg_resources' при установке CLIP)..."
  & $venvPython -m pip install --quiet --upgrade pip
  & $venvPython -m pip install --quiet "setuptools==69.5.1" wheel
  Ok "setuptools закреплён на рабочей версии."
} else {
  Warn "Не удалось создать/найти venv по пути $venvDir — AUTOMATIC1111 создаст его сам при первом запуске, но тогда может понадобиться повторно закрепить setuptools вручную, если всплывёт ошибка pkg_resources."
}

$launchUtilsForClip = Join-Path $InstallDir "modules\launch_utils.py"
if (Test-Path $launchUtilsForClip) {
  $luc = Get-Content $launchUtilsForClip -Raw
  if ($luc -match 'run_pip\(f"install \{[A-Za-z_]+\}", "' -and $luc -notmatch '--no-build-isolation') {
    $luc = [regex]::Replace($luc, 'run_pip\(f"install \{([A-Za-z_]+)\}", "', 'run_pip(f"install {$1} --no-build-isolation", "')
    Set-Content $launchUtilsForClip $luc -NoNewline
    Ok "Пропатчены установки CLIP/open_clip и похожих пакетов в launch_utils.py — добавлен --no-build-isolation."
  } else {
    Note "launch_utils.py уже пропатчен либо не требует фикса — пропускаю."
  }
}

# ── 6b. Фикс мёртвого репозитория Stability-AI/stablediffusion (404) ───────
# Известный баг апстрима AUTOMATIC1111 (Stability-AI удалили репозиторий):
# https://github.com/AUTOMATIC1111/stable-diffusion-webui/discussions/17212
$launchUtils = Join-Path $InstallDir "modules\launch_utils.py"
if (Test-Path $launchUtils) {
  $lu = Get-Content $launchUtils -Raw
  if ($lu -match 'Stability-AI/stablediffusion\.git') {
    $lu = $lu -replace 'https://github\.com/Stability-AI/stablediffusion\.git', 'https://github.com/w-e-w/stablediffusion.git'
    Set-Content $launchUtils $lu -NoNewline
    Ok "Пофикшена мёртвая ссылка на репозиторий (перенаправлена на рабочее зеркало)."
  } else {
    Note "launch_utils.py уже пофикшен либо не требует фикса — пропускаю."
  }
}
$brokenRepo = Join-Path $InstallDir "repositories\stable-diffusion-stability-ai"
if (Test-Path $brokenRepo) {
  Remove-Item -Recurse -Force $brokenRepo
  Note "Удалена сломанная папка repositories\stable-diffusion-stability-ai (пересоздастся заново)."
}

# ── 7. Модель ───────────────────────────────────────────────────────────
$modelsDir = Join-Path $InstallDir "models\Stable-diffusion"
New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null
$existingModels = Get-ChildItem $modelsDir -Include *.safetensors, *.ckpt -Recurse -ErrorAction SilentlyContinue

if ($ModelPath -and (Test-Path $ModelPath)) {
  Copy-Item $ModelPath $modelsDir -Force
  Ok "Модель скопирована в $modelsDir"
} elseif ($existingModels) {
  Ok "В $modelsDir уже есть модель ($($existingModels[0].Name)) — пропускаю."
} else {
  Warn "Модель не найдена. Civitai не даёт скачивать модели без входа в аккаунт, это придётся сделать вручную один раз:"
  Note "  1. Откройте https://civitai.com/models/34/all-in-one-pixel-model (или любую с тегом 'pixel art' и типом 'Checkpoint')"
  Note "  2. Скачайте .safetensors/.ckpt файл"
  Note "  3. Запустите этот скрипт снова, перетащив скачанный файл на quickstart.bat, либо:"
  Note "     powershell -ExecutionPolicy Bypass -File quickstart.ps1 -ModelPath 'C:\путь\к\модели.safetensors'"
  Note "Без модели WebUI всё равно запустится, но генерация не будет пиксель-артной."
}

# ── 8. Запуск WebUI в отдельном окне (не блокирует этот скрипт) ───────────
Step "Запускаю WebUI в отдельном окне (первый запуск качает зависимости — 10-20 минут)..."
Start-Process -FilePath $webuiUserBat -WorkingDirectory $InstallDir

# ── 9. Жду пока API станет доступен ────────────────────────────────────────
Step "Жду пока сервер откликнется на http://localhost:7860 ..."
$ready = $false
for ($i = 0; $i -lt 120; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:7860/sdapi/v1/sd-models" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch {}
  Start-Sleep -Seconds 10
  Write-Host "." -NoNewline
}
Write-Host ""
if ($ready) {
  Ok "AUTOMATIC1111 запущен и отвечает на http://localhost:7860"
} else {
  Warn "За 20 минут не откликнулся. Посмотрите окно WebUI (открылось отдельно) — там будет видна ошибка, если что-то пошло не так."
}

# ── 10. Локальный IP для доступа с другого устройства ─────────────────────
$lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } |
  Select-Object -First 1 -ExpandProperty IPAddress

if ($lanIp) {
  Ok "Адрес в локальной сети: http://${lanIp}:7860 — впишите его в PixelForge, если он на другом устройстве (например Mac)."
}

# ── 11. Запуск PixelForge ──────────────────────────────────────────────────
if (Test-Path (Join-Path $PixelForgeDir "package.json")) {
  Step "Запускаю PixelForge..."
  if (-not (Test-Path (Join-Path $PixelForgeDir "node_modules"))) {
    Note "node_modules отсутствует — выполняю npm install (один раз, может занять пару минут)..."
    Start-Process -FilePath "npm" -ArgumentList "install" -WorkingDirectory $PixelForgeDir -Wait -NoNewWindow
  }
  Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory $PixelForgeDir
  Ok "PixelForge запущен. В поле 'Адрес Stable Diffusion' должно быть http://localhost:7860 — нажмите 'Проверить'."
} else {
  Note "PixelForge не найден рядом со скриптом (ожидалась папка на уровень выше scripts/) — запустите его вручную: npm start"
}

Write-Host ""
Write-Host "=== Готово ===" -ForegroundColor Green
Write-Host ""
