@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在更新「楊梅高中梅岡風」網站資料...
echo 會處理「梅岡風」資料夾中新增或修改過的圖片，並做文字辨識。
echo.
python toolsuild.py %*
echo.
pause
