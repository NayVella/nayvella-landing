#!/usr/bin/env bash
set -euo pipefail
ORIGIN="${1:?Usage: $0 https://preview-project.pages.dev}"
mkdir -p reports
npx --yes lighthouse "${ORIGIN%/}/ar/" --chrome-flags="--headless --no-sandbox" --form-factor=mobile --output=html --output=json --output-path=reports/lighthouse-ar
npx --yes lighthouse "${ORIGIN%/}/en/" --chrome-flags="--headless --no-sandbox" --form-factor=mobile --output=html --output=json --output-path=reports/lighthouse-en
echo "Lighthouse reports written to reports/. INP requires interaction/field testing."
