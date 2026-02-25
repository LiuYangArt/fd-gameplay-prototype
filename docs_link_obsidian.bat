@echo off
chcp 65001
echo obsidian_vault_path

set /P vault_path=vault path: 
PAUSE


mklink /j "%vault_path%\fd_prototype_docs" ".\docs"



pause