@echo off
setlocal enabledelayedexpansion

rem Backup completo do Vorterium: banco, contas de login e arquivos do Storage.
rem
rem Tudo roda dentro de containers descartaveis do Docker, entao nao precisa de
rem Postgres nem de Node instalados na maquina - so do Docker Desktop aberto.
rem
rem Uso: clique duas vezes neste arquivo. Ele mostra o resultado na tela e espera
rem voce fechar. Cada execucao tambem grava uma linha em backup.log, entao da para
rem ver depois quando foi o ultimo backup bom.
rem
rem Se um dia isto for agendado no Windows, chame com /auto para ele nao ficar
rem esperando alguem apertar uma tecla.
rem
rem Os segredos (conexao.txt e chave.txt) ficam na PASTA de backups, FORA do
rem projeto, para nunca irem parar no GitHub. Veja COMO-USAR-E-RESTAURAR.txt.

if not defined PASTA set PASTA=D:\baixados\programacao_reserva\vorterium-backups
set AUTO=%1
set SCRIPTS=%~dp0.

for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set DATA=%%i
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format \"yyyy-MM-dd HH:mm\""') do set AGORA=%%i

set COMPLETO=%PASTA%\vorterium-%DATA%.sql
set DADOS=%PASTA%\vorterium-dados-%DATA%.sql
set AUTHSQL=%PASTA%\vorterium-auth-%DATA%.sql
set LOG=%PASTA%\backup.log
set ERRO=%PASTA%\erro-temp.log

echo.
echo   Backup do Vorterium - %AGORA%
echo   ------------------------------------------
echo.

if not exist "%PASTA%" mkdir "%PASTA%"

rem 1) O Docker esta de pe? Sem isso o resto nao acontece.
echo   [1/6] Conferindo o Docker...
docker info >nul 2>&1
if errorlevel 1 (
  set MOTIVO=Docker Desktop nao estava rodando. Abra ele e tente de novo.
  goto :falhou
)

rem 2) Os dois arquivos de segredo existem?
echo   [2/6] Conferindo a conexao e a chave...
if not exist "%PASTA%\conexao.txt" (
  set MOTIVO=conexao.txt nao encontrado em %PASTA%
  goto :falhou
)
if not exist "%PASTA%\chave.txt" (
  set MOTIVO=chave.txt nao encontrado em %PASTA%
  goto :falhou
)
set /p CONEXAO=<"%PASTA%\conexao.txt"

rem 3) O banco: tudo do schema public (estrutura + dados) e, separado, so os dados.
echo   [3/6] Baixando o banco... isso leva alguns segundos.
docker run --rm postgres:17 pg_dump "!CONEXAO!" --schema=public --no-owner >"%COMPLETO%" 2>"%ERRO%"
if errorlevel 1 (
  set MOTIVO=O pg_dump do banco deu erro. O detalhe esta em erro-temp.log
  goto :falhou
)
docker run --rm postgres:17 pg_dump "!CONEXAO!" --schema=public --data-only --no-owner --no-privileges >"%DADOS%" 2>"%ERRO%"
if errorlevel 1 (
  set MOTIVO=O pg_dump so dos dados deu erro. O detalhe esta em erro-temp.log
  goto :falhou
)

rem 4) As contas de login (e-mails e senhas ja embaralhadas). Ficam num schema que o
rem    Supabase administra, por isso um arquivo a parte.
echo   [4/6] Baixando as contas de login...
docker run --rm postgres:17 pg_dump "!CONEXAO!" --data-only --no-owner --table=auth.users --table=auth.identities >"%AUTHSQL%" 2>"%ERRO%"
if errorlevel 1 (
  set MOTIVO=O pg_dump das contas deu erro. O detalhe esta em erro-temp.log
  goto :falhou
)

rem 5) Saiu arquivo de verdade, com os dados dentro? Ja aconteceu (no CRM) de sair com
rem    0 bytes quando a conexao falha, e o arquivo existir engana quem so olha a pasta.
echo   [5/6] Conferindo o que veio...
for %%A in ("%COMPLETO%") do set TAMANHO=%%~zA
if !TAMANHO! LSS 100000 (
  set MOTIVO=O arquivo do banco saiu com apenas !TAMANHO! bytes, entao veio vazio.
  goto :falhou
)
for %%A in ("%DADOS%") do set TAMANHO2=%%~zA
if !TAMANHO2! LSS 10000 (
  set MOTIVO=O arquivo so de dados saiu com apenas !TAMANHO2! bytes, entao veio vazio.
  goto :falhou
)

for /f "delims=" %%i in ('powershell -NoProfile -Command "$n=0; $f=$false; foreach($l in [IO.File]::ReadLines('%COMPLETO%')){ if($l -like 'COPY public.campaigns *'){$f=$true;continue}; if($f -and $l -eq '\.'){break}; if($f){$n++} }; $n"') do set CAMPANHAS=%%i
if !CAMPANHAS! LSS 1 (
  set MOTIVO=O arquivo tem a estrutura das tabelas mas nenhuma campanha.
  goto :falhou
)
for /f "delims=" %%i in ('powershell -NoProfile -Command "$n=0; $f=$false; foreach($l in [IO.File]::ReadLines('%AUTHSQL%')){ if($l -like 'COPY auth.users *'){$f=$true;continue}; if($f -and $l -eq '\.'){break}; if($f){$n++} }; $n"') do set CONTAS=%%i
if !CONTAS! LSS 1 (
  set MOTIVO=O arquivo das contas veio sem nenhum usuario.
  goto :falhou
)

rem 6) Os arquivos do Storage (retratos, imagens, documentos, avatares). So baixa o que
rem    e novo, entao depois da primeira vez gasta quase nada do trafego do Supabase.
echo   [6/6] Baixando os arquivos do Storage... na primeira vez pode demorar.
set RESUMO=o script do Storage nao respondeu
for /f "delims=" %%i in ('docker run --rm --env-file "%PASTA%\chave.txt" -e DESTINO=/backup/storage -v "%PASTA%:/backup" -v "%SCRIPTS%:/app:ro" node:22-alpine node /app/storage-backup.mjs 2^>"%ERRO%"') do (
  echo     %%i
  set RESUMO=%%i
)
rem O "for" nao devolve o codigo de saida do node, entao a conta e feita lendo a linha
rem RESUMO (falhas=N) que ele imprime no fim.
echo !RESUMO! | findstr /c:"falhas=0" >nul
if errorlevel 1 (
  set MOTIVO=O banco foi salvo, mas o Storage nao veio completo. !RESUMO! - detalhe em erro-temp.log
  echo !AGORA!  PARCIAL - banco salvo em vorterium-%DATA%.sql, Storage com problema: !RESUMO!>>"%LOG%"
  goto :falhou_sem_log
)

echo !AGORA!  OK - vorterium-%DATA%.sql com !TAMANHO! bytes, !CAMPANHAS! campanhas, !CONTAS! contas; Storage: !RESUMO!>>"%LOG%"
del "%ERRO%" 2>nul

set /a MB=!TAMANHO! / 1048576
echo.
echo   ==========================================
echo     BACKUP CONCLUIDO
echo   ==========================================
echo.
echo     Banco:      vorterium-%DATA%.sql (!MB! MB)
echo     Campanhas:  !CAMPANHAS!
echo     Contas:     !CONTAS!
echo     Storage:    !RESUMO!
echo.
echo     Salvo em %PASTA%
echo.
goto :fim

:falhou
echo !AGORA!  FALHOU - !MOTIVO!>>"%LOG%"
:falhou_sem_log
echo.
echo   ==========================================
echo     O BACKUP NAO FOI FEITO POR COMPLETO
echo   ==========================================
echo.
echo     !MOTIVO!
echo.
echo     Nada foi alterado no site. Resolva o
echo     ponto acima e rode de novo.
echo.
if /i "%AUTO%"=="/auto" exit /b 1
pause
exit /b 1

:fim
if /i "%AUTO%"=="/auto" exit /b 0
pause
exit /b 0
