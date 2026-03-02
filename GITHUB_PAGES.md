# GitHub Pages への公開手順

## 前提条件

- GitHubアカウントがある
- Git がインストールされている
- `npm run dev` で正常に動作している

---

## STEP 1: GitHub にリポジトリを作成する

1. https://github.com にログイン
2. 右上の **「+」→「New repository」** をクリック
3. 以下のように設定する

| 項目 | 設定値 |
|------|--------|
| Repository name | `TB-employee-map` |
| Public / Private | **Public** |
| Initialize with README | チェックしない |

4. **「Create repository」** をクリック

---

## STEP 2: ローカルで Git を初期化してプッシュ

PowerShell でプロジェクトフォルダに移動し、以下を実行します。

```powershell
cd C:\Users\waka\Desktop\ddd\vue-project

git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/DevByWaka/TB-employee-map.git
git push -u origin main
```

---

## STEP 3: GitHub Actions の実行権限を設定する

1. GitHubのリポジトリページを開く
2. **Settings → Actions → General** を開く
3. **Workflow permissions** を **「Read and write permissions」** に変更
4. **Save** をクリック

---

## STEP 4: GitHub Actions のデプロイを確認する

プッシュすると自動でビルド＆デプロイが始まります。

1. リポジトリの **Actions タブ** を開く
2. **「Deploy to GitHub Pages」** のワークフローが実行中になっていることを確認
3. 緑のチェックマークになるまで待つ（1〜2分）

---

## STEP 5: GitHub Pages を有効にする

Actions 完了後に設定します。

1. **Settings → Pages** を開く
2. 以下のように設定する

| 項目 | 設定値 |
|------|--------|
| Source | Deploy from a branch |
| Branch | `gh-pages` |
| Folder | `/ (root)` |

3. **Save** をクリック

---

## STEP 6: 公開 URL にアクセスする

数分後、以下の URL でアクセスできます。

```
https://devbywaka.github.io/TB-employee-map/
```

Settings → Pages のページにも URL が表示されます。

---

## 今後の更新方法

コードを変更したら以下を実行するだけで自動再デプロイされます。

```powershell
git add .
git commit -m "変更内容のメモ"
git push
```

---

## トラブルシューティング

### ページが真っ白になる

`vite.config.js` の `base` を確認してください。

```javascript
base: '/TB-employee-map/',
```

### gh-pages ブランチが作られない

STEP 3 の **Workflow permissions** が「Read and write permissions」になっているか確認してください。

### Actions が失敗する

リポジトリの **Actions タブ** でエラーログを確認してください。
