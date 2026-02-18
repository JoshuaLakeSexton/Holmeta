#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <project-name>"
  exit 1
fi

RAW_NAME="$1"
NAME="$(echo "$RAW_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')"

if [ -z "$NAME" ]; then
  echo "Error: project name must contain letters or numbers."
  exit 1
fi

BASE_DIR="$HOME/Documents/Projects"
TARGET="$BASE_DIR/$NAME"

mkdir -p "$BASE_DIR"
if [ -e "$TARGET" ]; then
  echo "Error: $TARGET already exists."
  exit 1
fi

mkdir -p "$TARGET"/{apps,packages,scripts}
cat > "$TARGET/README.md" <<TXT
# $NAME

Scaffolded by holmeta new-project script.
TXT

echo "Created: $TARGET"
