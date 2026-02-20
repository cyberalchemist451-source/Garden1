@echo off
echo.
echo ====================================
echo   QUALIA APP - GITHUB SETUP WIZARD
echo ====================================
echo.

:: Check for Git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Git is NOT installed or not in PATH.
    echo.
    echo Attempting to install Git via Winget...
    echo (You may see a prompt asking for permission)
    echo.
    winget install --id Git.Git -e --source winget
    
    echo.
    echo ----------------------------------------------------------------
    echo If the installation succeeded, please CLOSE THIS WINDOW and run 
    echo this script again to reload the environment variables.
    echo.
    echo If it failed, please download Git manually from:
    echo https://git-scm.com/downloads
    echo ----------------------------------------------------------------
    pause
    exit /b
)

echo [OK] Git is installed!
echo.
echo Initializing Repository...
echo.

:: Init
git init
if %errorlevel% neq 0 goto Error

:: Add Changes
echo Adding files...
git add .
if %errorlevel% neq 0 goto Error

:: Commit
echo Committing...
git commit -m "Initial commit of Qualia App"
:: Ignore error if nothing to commit (already committed)

:: Branch
echo Rename branch to main...
git branch -M main

:: Remote
echo Adding remote origin...
:: Remove old origin if exists to avoid error
git remote remove origin 2>nul
git remote add origin https://github.com/cyberalchemist451-source/Garden.git
if %errorlevel% neq 0 goto Error

:: Push
echo Pushing to GitHub...
echo.
git push -u origin main
if %errorlevel% neq 0 (
    echo.
    echo [!] Push failed. Possible reasons:
    echo 1. You are not logged in to GitHub (a browser window should have opened).
    echo 2. The repository URL is incorrect.
    echo 3. You don't have permission to push to this repo.
    echo.
    pause
    exit /b
)

echo.
echo ====================================
echo   SUCCESS! CODE IS ON GITHUB.
echo ====================================
echo Now you can deploy to Vercel!
echo.
pause
exit /b

:Error
echo.
echo [!] An error occurred. See output above.
pause
