@echo off
echo ========================================
echo   BAM Financeiro - Deploy para Firebase
echo ========================================
echo.

set PROJECT_ID=bam-financeiro
set REGION=us-central1
set SERVICE_NAME=bam-financeiro-backend

echo [1/4] Fazendo login no Google Cloud...
gcloud auth login
gcloud config set project %PROJECT_ID%

echo.
echo [2/4] Deploy do Backend no Cloud Run...
cd backend
gcloud run deploy %SERVICE_NAME% ^
  --source . ^
  --region %REGION% ^
  --platform managed ^
  --allow-unauthenticated ^
  --set-env-vars ENVIRONMENT=production,SECRET_KEY=TROQUE-POR-CHAVE-FORTE,GOOGLE_CLOUD_PROJECT=%PROJECT_ID% ^
  --memory 512Mi ^
  --timeout 60
cd ..

echo.
echo [3/4] Build do Frontend...
cd frontend
call npm.cmd run build
cd ..

echo.
echo [4/4] Deploy do Frontend no Firebase Hosting...
firebase.cmd deploy --only hosting

echo.
echo ========================================
echo   Deploy concluido!
echo ========================================
