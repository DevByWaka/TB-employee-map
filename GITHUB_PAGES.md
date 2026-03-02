# GitHub Pages への公開手順

## 前提条件

- GitHubアカウントがある
- Git がインストールされている
- アプリが `npm run dev` で正常に動作している

---

## STEP 1: vite.config.js を修正する

GitHub Pages では URL が `https://ユーザー名.github.io/リポジトリ名/` になります。  
Vite の `base` オプションをリポジトリ名に合わせて設定する必要があります。

`vite.config.js` を以下のように修正します。

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  base: '/リポジトリ名/',   // ← ここをGitHubのリポジトリ名に変更
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

**例：** リポジトリ名が `employee-map` の場合
```javascript
base: '/employee-map/',
```

---

## STEP 2: GitHub にリポジトリを作成する

1. https://github.com にログイン
2. 右上の **「+」→「New repository」** をクリック
3. 以下のように設定する

| 項目 | 設定値 |
|------|--------|
| Repository name | `employee-map`（任意） |
| Public / Private | **Public**（GitHub Pages無料利用のため） |
| Initialize with README | チェックしない |

4. **「Create repository」** をクリック

---

## STEP 3: ローカルで Git を初期化してプッシュ

PowerShell でプロジェクトフォルダに移動し、以下を実行します。

```powershell
cd C:\Users\waka\Desktop\ddd\vue-project

git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/ユーザー名/employee-map.git
git push -u origin main
```

> `ユーザー名` と `employee-map` は実際のものに置き換えてください。

---

## STEP 4: GitHub Actions で自動デプロイを設定する

プロジェクトに `.github/workflows/` フォルダを作成し、  
`deploy.yml` ファイルを以下の内容で作成します。

```
vue-project/
└── .github/
    └── workflows/
        └── deploy.yml   ← このファイルを作成
```

**deploy.yml の内容：**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

作成したらコミット＆プッシュします。

```powershell
git add .
git commit -m "add GitHub Actions deploy workflow"
git push
```

---

## STEP 5: GitHub Pages を有効にする

1. GitHubのリポジトリページを開く
2. **Settings → Pages** を開く
3. **Source** を以下のように設定する

| 項目 | 設定値 |
|------|--------|
| Source | Deploy from a branch |
| Branch | `gh-pages` |
| Folder | `/ (root)` |

4. **Save** をクリック

> `gh-pages` ブランチは GitHub Actions が自動的に作成します。  
> Actions が完了（1〜2分）してから設定してください。

---

## STEP 6: 公開 URL にアクセスする

数分後、以下の URL でアクセスできます。

```
https://ユーザー名.github.io/employee-map/
```

Settings → Pages のページにも URL が表示されます。

---

## 今後の更新方法

コードを変更したら、以下を実行するだけで自動的に再デプロイされます。

```powershell
git add .
git commit -m "変更内容のメモ"
git push
```

GitHub Actions が自動でビルド＆デプロイを実行します（1〜2分で反映）。

---

## config.json について

GitHub Pages に公開する場合、`public/config.json` もそのまま公開されます。  
**anon key などの情報がファイルに書かれている場合は注意してください。**

DB設定は `localStorage` に保存する方式（初回アクセス時に入力）の方が、  
認証情報をリポジトリに含めずに済むため安全です。

---

## トラブルシューティング

### ページが真っ白になる

`vite.config.js` の `base` がリポジトリ名と一致しているか確認してください。

```javascript
base: '/employee-map/',  // 末尾のスラッシュも必要
```

### GitHub Actions が失敗する

リポジトリの **Actions タブ** でエラーログを確認してください。  
多くの場合、`npm install` の失敗か `vite.config.js` の記述ミスです。

### gh-pages ブランチが作られない

Actions の実行権限が不足している場合があります。  
**Settings → Actions → General → Workflow permissions** を  
**「Read and write permissions」** に変更してください。
