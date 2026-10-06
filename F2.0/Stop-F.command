#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
NODE="$PWD/runtime/node"
if [ ! -x "$NODE" ]; then NODE="$(command -v node)"; fi
"$NODE" offline/launcher.mjs stop
RESULT=$?
if [ "$RESULT" -ne 0 ]; then read -r -p "停止失敗，按 Enter 關閉。"; fi
exit "$RESULT"
