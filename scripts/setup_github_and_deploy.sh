#!/usr/bin/env bash
# Basit otomasyon scripti — GitHub repo oluşturup yerel değişiklikleri pushlar.
# Not: Bu script `gh` (GitHub CLI) ve `git` gerektirir; `gh` oturum açmış olmalıdır (gh auth login).

set -euo pipefail

echo "=== Neighborhood Fund: GitHub setup & push helper ==="

if ! command -v gh >/dev/null 2>&1; then
  echo "Lütfen önce GitHub CLI (gh) yükleyin ve 'gh auth login' ile giriş yapın." >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git yüklü değil. Lütfen git yükleyin." >&2
  exit 1
fi

REPO_NAME=${1:-neighborhood-fund}
VISIBILITY=${2:-public}

echo "Repo adı: $REPO_NAME (visibility: $VISIBILITY)"

# initialize git if needed
if [ ! -d .git ]; then
  git init
  echo "Initialized git repository"
fi

git add .
git commit -m "Prepare for deploy: frontend Netlify + backend Render" || true

echo "Creating GitHub repo (if doesn't exist) and pushing..."
gh repo create "$REPO_NAME" --$VISIBILITY --source=. --remote=origin --push || {
  echo "gh repo create returned non-zero; attempting to push to existing remote 'origin'..."
  git remote add origin "git@github.com:$(gh api user --jq .login)/$REPO_NAME.git" || true
  git push -u origin main
}

echo "Repo pushed. Next steps:\n"
echo "1) Backend deploy: önerilen: Render.com veya Railway. Render kullanacaksan: https://render.com -> New -> Web Service -> Connect GitHub -> seç repo -> Build: 'npm install' Start: 'node server.js'"
echo "   - Render içinde Environment Variables ekle: ADMIN_USER, ADMIN_PASS, ADMIN_TOKEN (opsiyonel)."
echo "2) Frontend deploy: Netlify -> New site -> Connect GitHub -> seç repo -> Build command: (boş) Publish dir: public"
echo "   - Netlify'de site hazır olduktan sonra Custom domain ekleyip DNS yönlendirmesini yapabilirsiniz."

echo "Eğer istersen bu adımlarda yardımcı olmamı söyle (ben adım adım yönlendirebilirim)."

echo "Done."
