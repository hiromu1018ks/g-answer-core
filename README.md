# G-Answer Core

自治体職員向けの答弁作成支援アプリケーションです。
RAG (Retrieval-Augmented Generation) 技術を活用し、過去の会議録や内部資料に基づいて、質問に対する答弁案を自動生成します。

## 機能

- **ナレッジ管理**: PDFやWordファイルのアップロードとベクトル化
- **ハイブリッド検索**: キーワード検索とベクトル検索を組み合わせた高精度な資料検索
- **AI起案**: 検索結果とRe-ranking（再ランク付け）を用いた、根拠に基づく答弁案の生成
- **モダンUI**: 直感的な3ペイン構成のインターフェース

## 前提条件

- Node.js (v18以上推奨)
- Python (v3.10以上推奨)
- Supabase アカウント

## 環境構築

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd g-answer-core
```

### 2. 環境変数の設定

ルートディレクトリに `.env.local` ファイルを作成し、以下の変数を設定してください。

```env
# Supabase設定
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Gemini API設定
GEMINI_API_KEY=your_gemini_api_key
```

### 3. バックエンド (Python) のセットアップ

```bash
cd backend
# 仮想環境の作成（推奨）
python -m venv venv
source venv/bin/activate  # Windowsの場合: venv\Scripts\activate

# 依存ライブラリのインストール
pip install -r requirements.txt
```

### 4. フロントエンド (React) のセットアップ

```bash
# ルートディレクトリで実行
npm install
```

## 起動方法

### バックエンドの起動

```bash
cd backend
python main.py
```
サーバーは `http://localhost:8000` で起動します。
初回起動時はAIモデルのダウンロードが行われるため、数分かかる場合があります。

### フロントエンドの起動

別のターミナルを開き、ルートディレクトリで実行します。

```bash
npm run dev
```
ブラウザで表示されたURL（通常は `http://localhost:5173`）にアクセスしてください。

## アーキテクチャ

- **Frontend**: React, Tailwind CSS, Vite
- **Backend**: Python (FastAPI), Sentence-Transformers (E5, Cross-Encoder)
- **Database**: Supabase (PostgreSQL, pgvector)
- **AI**: Google Gemini API
