# Leva o banco do backup para um projeto Supabase NOVO (Caso B do COMO-USAR-E-RESTAURAR.txt, passos 2 a 4).
# Nao mexe no Storage (arquivos) nem no projeto antigo: so escreve no projeto cuja string esta em conexao-novo.txt.
#
# Antes: crie a pasta/arquivo  D:\baixados\programacao_reserva\vorterium-backups\conexao-novo.txt
#        com UMA linha: a string de conexao do projeto NOVO (Connect > Direct > Session pooler, porta 5432),
#        com a senha do banco no lugar de [YOUR-PASSWORD].
#
# Uso:   powershell -ExecutionPolicy Bypass -File backup\restaurar-no-novo.ps1
# Se parar numa migration, corrija e continue dela com:  ... -Partir NOME-DO-ARQUIVO.sql

param([string]$Partir = '', [switch]$SoDados)

$ErrorActionPreference = 'Stop'
$pasta = 'D:\baixados\programacao_reserva\vorterium-backups'
$migrations = Join-Path $PSScriptRoot '..\supabase\migrations' | Resolve-Path | Select-Object -ExpandProperty Path
$arqConexao = Join-Path $pasta 'conexao-novo.txt'

if (-not (Test-Path $arqConexao)) { throw "Falta o arquivo $arqConexao (uma linha, a string de conexao do projeto NOVO)." }
$conn = (Get-Content $arqConexao -Raw).Trim()
if ($conn -match '\[YOUR-PASSWORD\]') { throw 'A string ainda tem [YOUR-PASSWORD]: troque pela senha do banco do projeto novo.' }

$dados = Get-ChildItem $pasta -Filter 'vorterium-dados-*.sql' | Sort-Object Name | Select-Object -Last 1
$auth  = Get-ChildItem $pasta -Filter 'vorterium-auth-*.sql'  | Sort-Object Name | Select-Object -Last 1
if (-not $dados -or -not $auth) { throw 'Nao achei vorterium-dados-*.sql e vorterium-auth-*.sql em vorterium-backups.' }

Write-Host "Projeto novo: $(($conn -replace ':[^:@]*@', ':****@'))"
Write-Host "Dados: $($dados.Name)   Contas: $($auth.Name)"
if ($Partir -eq '' -and -not $SoDados) {
  # trava de seguranca: projeto novo tem que estar vazio de tabelas do site
  $existe = docker run --rm postgres:17 psql $conn -At -c "select to_regclass('public.campaigns') is not null" 2>&1
  if ("$existe".Trim() -eq 't') { throw 'O projeto ja tem a tabela campaigns. Esta nao parece ser um projeto novo e vazio. Parei sem mexer em nada.' }
  if ("$existe".Trim() -ne 'f') { throw "Nao consegui conectar no projeto novo: $existe" }
}

$caat = Join-Path $PSScriptRoot '..\guardado\caatedrum\migrations' | Resolve-Path | Select-Object -ExpandProperty Path
$montagens = @('-v', "${migrations}:/mig:ro", '-v', "${pasta}:/bk:ro", '-v', "${PSScriptRoot}:/app:ro", '-v', "${caat}:/caat:ro")

if (-not $SoDados) {
  Write-Host "`n== Passo 2: estrutura (migrations em ordem) =="
  docker run --rm -e "CONN=$conn" -e "PARTIR=$Partir" @montagens postgres:17 sh /app/restaurar-no-novo.sh mig
  if ($LASTEXITCODE -ne 0) { throw "Migration falhou (veja PAROU EM acima). Nada de dados foi carregado ainda." }
}

Write-Host "`n== Passo 2b: ajustes do esquema (colunas sheet + Caatedrum) =="
docker run --rm -e "CONN=$conn" @montagens postgres:17 sh /app/restaurar-no-novo.sh extras
if ($LASTEXITCODE -ne 0) { throw "Ajustes falharam (veja PAROU EM acima). Nada de dados foi carregado." }

Write-Host "`n== Passo 3: dados =="
docker run --rm -e "CONN=$conn" -e "ARQ=$($dados.Name)" @montagens postgres:17 sh /app/restaurar-no-novo.sh dados
if ($LASTEXITCODE -ne 0) { throw 'Falha ao carregar os dados (tudo-ou-nada: nada foi gravado). Pare e me chame.' }

Write-Host "`n== Passo 4: contas de login =="
docker run --rm -e "CONN=$conn" -e "ARQ=$($auth.Name)" @montagens postgres:17 sh /app/restaurar-no-novo.sh auth
if ($LASTEXITCODE -ne 0) { throw 'Falha ao carregar as contas (nada gravado nessa etapa). Pare e me chame.' }

Write-Host "`n== Conferencia =="
docker run --rm postgres:17 psql $conn -c "select (select count(*) from auth.users) as contas, (select count(*) from public.campaigns) as campanhas, (select count(*) from public.character_sheets) as fichas"
Write-Host "`nPRONTO. Proximos: configurar Google/URLs no painel (passo 6) e trocar as chaves do site (passo 7)."
