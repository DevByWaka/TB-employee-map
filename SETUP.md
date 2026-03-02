# 従業員配置マップ セットアップガイド

## 必要なもの

- Node.js 18以上
- Supabaseアカウント（無料プランでOK）
- GitHubアカウント（公開する場合）

---

## STEP 1: Supabase プロジェクト作成

1. https://supabase.com にアクセスしてログイン
2. **New project** をクリック
3. プロジェクト名・パスワード・リージョン（Northeast Asia など）を入力して作成
4. プロジェクトの準備が完了するまで待つ（1〜2分）

---

## STEP 2: Supabase にテーブルを作成

Supabase ダッシュボードの左メニューから **SQL Editor** を開き、  
以下を全て貼り付けて **Run** をクリックします。

```sql
create table nodes (
  id text primary key,
  label text not null,
  node_group text not null,
  employee_id text,
  birthdate text,
  gender text,
  transport text,
  phone text,
  email text,
  notes text,
  title text,
  password text
);

create table edges (
  id text primary key,
  from_id text,
  to_id text,
  edge_type text,
  assignment_type text default 'home',
  working_slots jsonb default '[]',
  customer_name text,
  contact_person text,
  contact_phone text,
  contact_email text,
  customer_notes text,
  title text
);

create table admins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  employee_id text unique not null,
  password text not null,
  created_at timestamptz default now()
);

alter table nodes  disable row level security;
alter table edges  disable row level security;
alter table admins disable row level security;
```

> 管理者アカウントはアプリ初回起動時に画面から作成します（SQLへの記載不要）。

---

## STEP 3: Supabase の接続情報を確認

左メニューの **Project Settings → API** を開きます。

| 項目 | 場所 |
|------|------|
| Project URL | `https://xxxx.supabase.co` の形式 |
| anon / public key | `eyJhbGciOi...` で始まる長い文字列 |

この2つは STEP 7 で使います。

---

## STEP 4: Vite プロジェクトを作成

PowerShell で以下を実行します。

```powershell
npm create vite@latest vue-project -- --template vue
cd vue-project
npm install
npm install vue-router pinia
```

---

## STEP 5: アプリのファイルを配置

ダウンロードした ZIP を展開し、`fresh/` フォルダの中身をプロジェクトに上書きコピーします。

```
vue-project/
├── index.html
├── vite.config.js
├── .github/
│   └── workflows/
│       └── deploy.yml      ← GitHub Pages 自動デプロイ設定
└── src/
    ├── main.js
    ├── App.vue
    ├── assets/
    │   └── employee-map.css
    ├── router/
    │   └── index.js
    ├── stores/
    │   └── employeeMap.js
    ├── views/
    │   └── MapView.vue
    └── components/  (9ファイル)
```

既存の `src/style.css`、`src/components/HelloWorld.vue` などは削除して構いません。

---

## STEP 6: ローカルで動作確認

```powershell
npm run dev
```

ブラウザで `http://localhost:5173/` を開きます。

---

## STEP 7: DB接続設定

初回起動時は **DB設定画面** が表示されます。

| 項目 | 入力値 |
|------|--------|
| 接続タイプ | Supabase |
| URL | STEP 3 で確認した Project URL |
| anon key | STEP 3 で確認した anon / public key |

**「接続してログインへ →」** をクリックします。

---

## STEP 8: 初期管理者を作成

DB接続後、管理者がまだいない場合は **管理者作成画面** が自動的に表示されます。

| 項目 | 内容 |
|------|------|
| 名前 | 管理者の名前 |
| 社員ID | ログイン時に使うID |
| パスワード | 6文字以上 |
| パスワード（確認） | 同じものを再入力 |

作成後、そのままログイン画面へ進みます。

---

## STEP 9: ログイン

STEP 8 で設定した社員ID・パスワードでログインします。

---

## 初回ログイン後にやること

### 担当者を追加する

サイドバーの **「担当者を追加」** ボタンから追加できます。  
担当者のログイン用パスワードは管理者パネル（👑）で設定します。

### 管理者を追加する

管理者パネル（👑）→ **「管理者を追加」** から追加できます。

---

## config.json を使う場合（オプション）

プロジェクトの `public/` フォルダに `config.json` を作成すると  
起動時に自動読み込みされ DB設定画面がスキップされます。

```json
{
  "dbType": "supabase",
  "supabase": {
    "url": "https://xxxx.supabase.co",
    "key": "eyJhbGciOi..."
  }
}
```

> GitHub Pages で公開する場合、このファイルも公開されます。  
> anon key の漏洩が気になる場合は config.json を使わず、  
> 各自が初回アクセス時に画面で入力する方式を推奨します。

---

## パスワードを忘れた場合

Supabase の SQL Editor で確認・変更できます。

```sql
-- 管理者一覧を確認
select name, employee_id, password from admins;

-- パスワードをリセット
update admins set password = 'newpassword' where employee_id = '社員ID';
```
