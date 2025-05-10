document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('drop-area');
    const fileElem = document.getElementById('fileElem');
    const loadingDiv = document.getElementById('loading');
    const previewArea = document.getElementById('preview-area');
    const outputImage = document.getElementById('outputImage');
    const downloadLink = document.getElementById('downloadLink');

    // img.ly SDK の removeBackground 関数を取得
    const removeBackground = window.imglyRemoveBackground && window.imglyRemoveBackground.removeBackground;

    if (!removeBackground) {
        console.error('img.ly Background Removal SDK が正しく読み込まれていません。');
        alert('背景切り抜きライブラリの読み込みに失敗しました。ページをリロードするか、開発者コンソールを確認してください。');
        dropArea.innerHTML = "<p style='color: red;'>エラー: 背景切り抜き機能を利用できません。</p>";
        return;
    }
    
    // ドラッグアンドドロップイベントの設定
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false); // body全体でのドロップも防ぐ
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('highlight'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('highlight'), false);
    });

    dropArea.addEventListener('drop', handleDrop, false);
    dropArea.addEventListener('click', () => fileElem.click()); // dropAreaクリックでファイル選択ダイアログを開く
    fileElem.addEventListener('change', function(e) { // ファイルが選択された時
        if (this.files && this.files.length > 0) {
            handleFiles(this.files);
            this.value = null; // 同じファイルを連続して選択できるようにリセット
        }
    });

    // クリップボードからの貼り付けイベントの設定
    window.addEventListener('paste', handlePaste);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    async function handlePaste(event) {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        let file = null;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                file = items[i].getAsFile();
                break;
            }
        }
        if (file) {
            await processImage(file);
        } else {
            // 画像以外のものが貼り付けられた場合は無視するか、通知する
            // console.log('貼り付けられたデータは画像ではありません。');
        }
    }
    
    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0]; // 最初のファイルのみ処理
            if (file.type.startsWith('image/')) {
                processImage(file);
            } else {
                alert('画像ファイルを選択してください。');
            }
        }
    }

    async function processImage(file) {
        loadingDiv.style.display = 'block';
        previewArea.style.display = 'none';
        outputImage.src = '#'; // 前のプレビューをクリア
        downloadLink.style.display = 'none';

        try {
            // removeBackground関数はBlobを返します
            const config = {
                // publicPath: 'https://cdn.img.ly/packages/imgly/background-removal/1.3.3/assets/', // 通常は自動解決されます
                // progress: (key, current, total) => { // 進捗表示が必要な場合
                //    console.log(`Downloading ${key}: ${Math.round((current/total) * 100)}%`);
                // },
                output: {
                    format: 'image/png' // 出力フォーマット (デフォルトは PNG)
                }
            };
            const blob = await removeBackground(file, config);

            const imageUrl = URL.createObjectURL(blob);

            // 「自動で画像の大きさを調整」:
            // 1. img.ly SDKがオブジェクトに合わせて画像をクロップします。
            // 2. プレビュー表示はCSSのmax-width/max-heightで調整されます。
            //    特定の固定サイズにしたい場合は、ここでCanvasを使ってリサイズ処理を追加します。
            //    例: const resizedImageUrl = await resizeImageWithCanvas(imageUrl, 800, 600);
            //    今回はCSSによる表示調整に留めます。
            
            outputImage.onload = () => {
                // 画像読み込み完了後、必要ならここでサイズ情報を取得したりできます。
                URL.revokeObjectURL(outputImage.src); // メモリ解放 (ダウンロード用にimageUrlは保持)
            };
            outputImage.src = imageUrl; 
            
            // ダウンロードリンクの設定
            downloadLink.href = imageUrl;
            const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, -4); // YYYYMMDDTHHMMSS形式
            const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || 'image';
            downloadLink.download = `bg_removed_${originalName}_${timestamp}.png`;

            previewArea.style.display = 'block';
            downloadLink.style.display = 'inline-block';

        } catch (error) {
            console.error('画像処理エラー:', error);
            let errorMessage = '画像の処理中にエラーが発生しました。';
            if (error && error.message) {
                errorMessage += `\n詳細: ${error.message}`;
            }
            // SDK関連のエラーメッセージが具体的にあるか確認
            if (error && typeof error === 'string' && error.includes("model")) {
                 errorMessage += '\n(モデルファイルの読み込みに失敗した可能性があります。ネットワーク接続を確認してください。)';
            }
            alert(errorMessage);
        } finally {
            loadingDiv.style.display = 'none';
        }
    }

    // (オプション) 特定のサイズにリサイズする関数 (Canvasを使用)
    // async function resizeImageWithCanvas(imageUrl, maxWidth, maxHeight) {
    //     return new Promise((resolve, reject) => {
    //         const img = new Image();
    //         img.onload = () => {
    //             const canvas = document.createElement('canvas');
    //             const ctx = canvas.getContext('2d');
    //             let width = img.width;
    //             let height = img.height;

    //             if (width > height) {
    //                 if (width > maxWidth) {
    //                     height = Math.round((height * maxWidth) / width);
    //                     width = maxWidth;
    //                 }
    //             } else {
    //                 if (height > maxHeight) {
    //                     width = Math.round((width * maxHeight) / height);
    //                     height = maxHeight;
    //                 }
    //             }
    //             canvas.width = width;
    //             canvas.height = height;
    //             ctx.drawImage(img, 0, 0, width, height);
    //             resolve(canvas.toDataURL('image/png'));
    //         };
    //         img.onerror = reject;
    //         img.src = imageUrl;
    //     });
    // }
});
