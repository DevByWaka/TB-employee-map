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

-- 初期管理者（社員ID・パスワードは自由に変更してください）
insert into admins (name, employee_id, password)
values ('管理者', '00000000', 'admin1234');
```

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
├── index.html              ← fresh/index.html で上書き
├── vite.config.js          ← fresh/vite.config.js で上書き
├── .github/
│   └── workflows/
│       └── deploy.yml      ← 新規追加（GitHub Pages用）
└── src/
    ├── main.js             ← fresh/src/main.js で上書き
    ├── App.vue             ← fresh/src/App.vue で上書き
    ├── assets/
    │   └── employee-map.css
    ├── router/
    │   └── index.js
    ├── stores/
    │   └── employeeMap.js
    ├── views/
    │   └── MapView.vue
    └── components/
        ├── LoginOverlay.vue
        ├── NetworkGraph.vue
        ├── AppSidebar.vue
        ├── NodeModal.vue
        ├── EdgeModal.vue
        ├── CustomerModal.vue
        ├── AddManagerModal.vue
        ├── SettingsModal.vue
        └── AdminPanel.vue
```

既存の `src/style.css`、`src/components/HelloWorld.vue` などは削除して構いません。

---

## STEP 6: ローカルで動作確認

```powershell
npm run dev
```

ブラウザで `http://localhost:5173/` を開き、DB設定画面が表示されることを確認します。

---

## STEP 7: DB接続設定

初回起動時は **DB設定画面** が表示されます。

| 項目 | 入力値 |
|------|--------|
| 接続タイプ | Supabase |
| URL | STEP 3 で確認した Project URL |
| anon key | STEP 3 で確認した anon / public key |

**「接続してログインへ →」** をクリックします。  
成功するとログイン画面に切り替わります。

> 設定は自動的に保存され、次回起動時からは自動接続されます。

---

## STEP 8: ログイン

| 項目 | 値 |
|------|-----|
| 社員ID | `00000000` |
| パスワード | `admin1234` |

（STEP 2 の SQL で設定した値）

---

## 初回ログイン後にやること

### 管理者パスワードを変更する

Supabase SQL Editor で実行します。

```sql
update admins
set password = '新しいパスワード'
where employee_id = '00000000';
```

### 担当者を追加する

サイドバーの **「担当者を追加」** ボタンから追加できます。  
担当者のログイン用パスワードは管理者パネル（👑）で設定します。

---

## config.json を使う場合（オプション）

プロジェクトの `public/` フォルダに `config.json` を作成すると、  
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
> セキュリティが気になる場合は config.json を使わず、  
> 各自が初回アクセス時に画面で入力する方式を推奨します。

---

## ログイン情報を忘れた場合

Supabase の SQL Editor で確認・変更できます。

```sql
-- 管理者一覧を確認
select name, employee_id, password from admins;

-- パスワードをリセット
update admins set password = 'newpassword' where employee_id = '00000000';
```
