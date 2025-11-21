# How to Revert Changes - Safety Instructions

**Created:** November 21, 2025
**Safe versions available:**
- Tag: `v1.0.1-pre-js-rendering`
- Branch: `backup/before-rendering-20251121`

---

## 🚨 Emergency Revert (If Something Breaks)

### Option 1: Revert to Safe Tag (Recommended)
```bash
# This reverts ALL changes back to pre-implementation state
git reset --hard v1.0.1-pre-js-rendering

# If you've already pushed broken changes:
git push -f origin claude/clarify-session-purpose-01MZhRQi7DmWRmXUqTqXy2UX
```

### Option 2: Revert to Backup Branch
```bash
# Switch to backup branch
git checkout backup/before-rendering-20251121

# Or merge backup into current branch
git reset --hard backup/before-rendering-20251121
```

### Option 3: Revert Specific Commits
```bash
# See recent commits
git log --oneline -10

# Revert specific commit (creates new revert commit)
git revert <commit-hash>

# Or undo last commit (keeps changes staged)
git reset --soft HEAD~1
```

---

## 📊 What Was Changed (Implementation Phases)

### Phase 1: JavaScript Rendering Support
**Files changed:**
- `package.json` - Added puppeteer dependency
- `server.js` - Added JS rendering toggle
- `.env` - Added JS rendering config

**To revert just Phase 1:**
```bash
git revert <phase-1-commit-hash>
npm install  # Remove puppeteer
```

### Phase 2: Enhanced Bot Bypass
**Files changed:**
- `server.js` - Enhanced headers function

**To revert just Phase 2:**
```bash
git revert <phase-2-commit-hash>
```

---

## 🧪 Test Before Committing

Always test after each phase:
```bash
# Start server
node server.js

# Test with simple site first
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://schema.org"}'

# Test with real hotel
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.marriott.com"}'
```

---

## 📝 Safe Development Process

1. **Each phase = separate commit**
   - Easy to revert individual features
   - Clear git history

2. **Test after each commit**
   - Don't stack multiple changes
   - Identify breaking changes immediately

3. **Push after testing**
   - Only push verified working code
   - Backup on remote

---

## 🔍 Check Current State

```bash
# See what's changed
git status

# See uncommitted changes
git diff

# See recent commits
git log --oneline -5

# See all branches
git branch -a

# See all tags
git tag -l
```

---

## 📱 Revert from Vercel (If Deployed)

If broken code is deployed to Vercel:

1. **Revert local code** (using options above)
2. **Push to trigger re-deploy:**
   ```bash
   git push -u origin claude/clarify-session-purpose-01MZhRQi7DmWRmXUqTqXy2UX
   ```
3. **Or manually revert in Vercel dashboard:**
   - Go to Deployments
   - Find last working deployment
   - Click "Promote to Production"

---

## 🆘 Nuclear Option (Start Fresh)

If everything is broken and you want to start over:

```bash
# Clone fresh from main branch
git fetch origin main
git checkout main
git pull origin main

# Start new branch
git checkout -b fix/fresh-start

# Cherry-pick only the good commits
git cherry-pick <good-commit-hash>
```

---

## ✅ Verify Revert Worked

After reverting:
```bash
# Check files are reverted
git status

# Test server starts
node server.js

# Test basic analysis
npm test  # If tests exist

# Check on Vercel
# Visit your deployed URL
```

---

## 📞 Quick Reference

**Safe versions:**
- `v1.0.1-pre-js-rendering` - Before JS rendering
- `backup/before-rendering-20251121` - Backup branch

**Emergency revert:**
```bash
git reset --hard v1.0.1-pre-js-rendering
```

**See what changed:**
```bash
git diff v1.0.1-pre-js-rendering..HEAD
```

**Revert specific file:**
```bash
git checkout v1.0.1-pre-js-rendering -- server.js
```
