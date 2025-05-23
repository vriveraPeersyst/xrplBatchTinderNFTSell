#!/usr/bin/env bash
set -euo pipefail

# Name of the output file
OUTPUT_FILE="repo_report.txt"

# Derive the repo root folder name
ROOT_DIR="$(basename "$PWD")"

# Remove existing output file
rm -f "$OUTPUT_FILE"

#######################################
# 1. Generate and append repo structure
#######################################

echo "====================================" >> "$OUTPUT_FILE"
echo "          REPO STRUCTURE            " >> "$OUTPUT_FILE"
echo "====================================" >> "$OUTPUT_FILE"

# Include everything starting from the root of the repo
# Run tree on '.' but replace the leading '.' line with your actual folder name
tree -a -I "node_modules|.git|.next|coverage|dist|build|artifacts|typechain-types|*.pack.gz|*.webp|*.cache|package-lock.json|pnpm-lock.yaml|yarn.lock|*.ico|*.png|*.jpg|*.jpeg|*.svg|*.gif|.DS_Store|abis|main.*.js|.env" . 2>/dev/null \
  | sed "1s/^\.$/${ROOT_DIR}/" \
  >> "$OUTPUT_FILE"


#######################################
# 2. Append contents of important files
#######################################

echo -e "\n\n====================================" >> "$OUTPUT_FILE"
echo "          FILE CONTENTS             " >> "$OUTPUT_FILE"
echo "====================================" >> "$OUTPUT_FILE"

find . -type f \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/.next/*" \
    -not -path "*/coverage/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/artifacts/*" \
    -not -path "*/typechain-types/*" \
    -not -name "package-lock.json" \
    -not -name "pnpm-lock.yaml" \
    -not -name "yarn.lock" \
    -not -name ".gitignore" \
    -not -name "*.ico" \
    -not -name "*.png" \
    -not -name "*.jpg" \
    -not -name "*.jpeg" \
    -not -name "*.svg" \
    -not -name "*.gif" \
    -not -name "*.webp" \
    -not -name ".env" \
    -not -name "generate_report.sh" \
    -not -name "repo_report.txt" \
| while IFS= read -r file; do
    # Always include .env.example
    if [[ "$(basename "$file")" == ".env.example" ]]; then
        echo -e "\n-------- $file --------" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
    else
        echo -e "\n-------- $file --------" >> "$OUTPUT_FILE"
        if file "$file" | grep -q "text"; then
            cat "$file" >> "$OUTPUT_FILE"
        else
            echo "[Binary file content skipped]" >> "$OUTPUT_FILE"
        fi
    fi
done

# Final message
echo "Report generated in '$OUTPUT_FILE'."

