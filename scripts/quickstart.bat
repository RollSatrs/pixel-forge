@echo off
REM Двойной клик — запускает всё автоматически.
REM Есть скачанная модель? Перетащите её файл прямо на эту иконку —
REM тогда она скопируется в нужную папку сама.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0quickstart.ps1" -ModelPath "%~1"
echo.
pause
