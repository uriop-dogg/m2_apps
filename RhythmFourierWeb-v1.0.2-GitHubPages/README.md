# Rhythm Fourier Web

**音の強弱の変化を、周波数解析して観察するブラウザーアプリです。**

Rhythm Wave Lab 2 の画面・解析機能をHTML / JavaScriptへ移植しました。音声から瞬間振幅を取り出し、その時間変化をフーリエ解析します。ここでの周波数は音の高さではなく、強弱の変化の速さです。1秒間に2回繰り返す変化は2 Hz、BPM相当では120になります。

音声を再生しながら周期成分を観察し、テンポ・拍子・音符の長さを指定してハーモニクスを表示できます。音の重なりや干渉による振幅変動も含めて解析します。

## 機能

- 音声波形と瞬間振幅、瞬間振幅の全周波数、固定周波数の時間波形・位相、音符付きハーモニクス表示
- 現在位置 / 音声全体、絶対値 / 位相色 / 実部 / 虚部
- 単体・2画面・4画面。各配置の選択状態を保持
- 音声の範囲指定と、その区間の再生・解析
- WAV音源の読み込み、ブラウザーが対応する圧縮音声の読み込み
- 自己完結した `.irhythm` プロジェクトの保存・読み込み（デスクトップ版 v0.5.3 と相互利用）
- CSV・NPZ（複素係数を含む）、SVG・PNG書き出し
- 日本語 / English、サンプル音源2曲、比較デモ

音声はブラウザー内で処理します。アップロード用サーバー、アカウント登録、Python、FFmpegは不要です。実行時に外部CDNからライブラリを取得しません。

## GitHub Pagesで公開する

配布ZIPを展開し、**中のファイルとフォルダーを、階層を保ったまま**リポジトリへアップロードします。ZIPそのものを置くだけではウェブアプリになりません。

```text
index.html
assets/
samples/
README.html
README.en.html
README.md
THIRD_PARTY_NOTICES.txt
.nojekyll
```

1. 公開先リポジトリで **Add file → Upload files** を選び、上の一式をアップロードしてコミットします。
2. **Settings → Pages** を開きます。
3. **Build and deployment → Source → Deploy from a branch** を選択します。
4. **Branch: main / Folder: /(root)** を選んで **Save** します。
5. Pagesに表示される公開URLを開きます。

リポジトリ名を仮に `rhythm-fourier-web` とした場合、通常のプロジェクトサイトのURLは `https://uriop-dogg.github.io/rhythm-fourier-web/` になります。これは例であり、公開済みのURLではありません。

既存リポジトリに併設する場合は、同じ一式を `docs/` に入れて、公開フォルダーを `/docs` にできます。相対パスを使っているので、リポジトリ名の設定やビルドは不要です。

手順の出典：[GitHub公式の公開元設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。GitHub上の公開操作は利用者が行います。

## 使い方

公開URLを開くと `rhythms2.wav`（110 BPM）を読み込んで解析します。音声は自動再生しません。**再生**を押して音を聴きながらグラフを見てください。

詳しい説明・数式は [日本語の説明書](README.html) / [English manual](README.en.html) を参照してください。

## ローカルで確認する

`index.html` をダブルクリックする `file://` での起動には対応していません。ES modules・Web Worker・サンプル取得にHTTPが必要です。

Pythonがある開発環境では、このフォルダーで次を実行して `http://localhost:8000/` を開けます。

```sh
python -m http.server 8000
```

公開後の閲覧者にはPythonは不要です。Chrome / Edgeのデスクトップ環境を主な確認対象としています。対応する音声形式や扱える長さはブラウザー・端末に依存します。WAV以外はWeb Audioのデコードでサンプルレートが変わる場合があります。長い音声は範囲指定またはSTFTの時間刻みを調整してください。

## 開発

`assets/dsp.js` が数値解析、`worker.js` が解析Worker、`audio.js` が音声、`plots.js` がCanvas / SVG、`files.js` がNPY / NPZとプロジェクト、`app.js` がUIです。ビルド工程はありません。

開発フォルダーの `tests/` にはデスクトップ版との数値比較とブラウザー操作テストがあります。公開用ZIPにはテスト用音声断片・ブラウザープロファイルは含みません。

外部ライブラリ：fflate 0.8.2（MIT）。ライセンスは `assets/fflate-LICENSE.txt` に同梱しています。

---

**English:** Rhythm Fourier Web explores changes in audio amplitude through Fourier analysis. It is a static browser edition of Rhythm Wave Lab 2. Upload the extracted contents to a GitHub Pages publishing directory; no build or server-side processing is needed. Audio remains in the browser. Read the [English manual](README.en.html) for operation, formulas and browser limitations.
