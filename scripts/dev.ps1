param(
  [ValidateSet("menu", "install", "dev", "typecheck", "lint", "lintfix", "format", "formatcheck", "test", "build", "verify")]
  [string]$Command = "menu"
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Path $PSScriptRoot -Parent
Set-Location $RootDir

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Error "未检测到 pnpm，请先安装 pnpm（或启用 corepack）。"
}

function Invoke-Task {
  param([string]$Task)

  switch ($Task) {
    "install" { pnpm install }
    "dev" { pnpm dev }
    "typecheck" { pnpm typecheck }
    "lint" { pnpm lint }
    "lintfix" { pnpm lint:fix }
    "format" { pnpm format }
    "formatcheck" { pnpm format:check }
    "test" { pnpm test }
    "build" { pnpm build }
    "verify" { pnpm verify }
    default { throw "未知任务: $Task" }
  }
}

function Show-Menu {
  Write-Host "================ 开发菜单（Windows） ================"
  Write-Host "1) install   安装依赖"
  Write-Host "2) dev       一键启动开发服务器"
  Write-Host "3) typecheck 类型检查"
  Write-Host "4) lint      运行 ESLint"
  Write-Host "5) lintfix   自动修复 ESLint 问题"
  Write-Host "6) format    运行 Prettier 格式化"
  Write-Host "7) formatcheck 检查 Prettier 格式"
  Write-Host "8) test      运行核心单测"
  Write-Host "9) build     构建全部包"
  Write-Host "10) verify   一键回归（typecheck + lint + test + build）"
  Write-Host "q) 退出"
  Write-Host "===================================================="
}

if ($Command -ne "menu") {
  Invoke-Task -Task $Command
  exit 0
}

while ($true) {
  Show-Menu
  $choice = Read-Host "请选择操作"
  switch ($choice) {
    "1" { Invoke-Task -Task "install" }
    "2" { Invoke-Task -Task "dev" }
    "3" { Invoke-Task -Task "typecheck" }
    "4" { Invoke-Task -Task "lint" }
    "5" { Invoke-Task -Task "lintfix" }
    "6" { Invoke-Task -Task "format" }
    "7" { Invoke-Task -Task "formatcheck" }
    "8" { Invoke-Task -Task "test" }
    "9" { Invoke-Task -Task "build" }
    "10" { Invoke-Task -Task "verify" }
    "q" { break }
    "Q" { break }
    default { Write-Host "无效选项，请重试。" }
  }
}
