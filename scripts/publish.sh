#!/usr/bin/env bash
# publish.sh — build บล็อก + push GitHub + deploy Vercel ในคำสั่งเดียว
# ใช้โดย ll-marketing หลังเขียนบทความใหม่ลง content/articles/
# ต้องมี env: VERCEL_TOKEN
set -e
cd "$(dirname "$0")/.."

echo "▶ 1/4 สร้างหน้าบล็อกจาก markdown..."
node scripts/build-blog.js

echo "▶ 2/4 commit..."
git add -A
if git diff --cached --quiet; then
  echo "   (ไม่มีการเปลี่ยนแปลง ข้าม commit)"
else
  git -c user.name="logiclayerthailand" -c user.email="ukrit.enetcity@gmail.com" \
    commit -q -m "blog: publish/update articles ($(node -e "process.stdout.write(new Date().toISOString().slice(0,10))"))"
fi

echo "▶ 3/4 push GitHub..."
git push -q origin main || echo "   (push ข้าม — เช็ค remote)"

echo "▶ 4/4 deploy Vercel..."
npx --yes vercel@latest deploy --prod --yes --token "$VERCEL_TOKEN" --scope logiclayerthailand-9198s-projects | tail -1

echo "✅ เผยแพร่เรียบร้อย — https://petspace.vercel.app/blog.html"
