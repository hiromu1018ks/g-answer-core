/**
 * テキストを指定文字数で分割し、オーバーラップを持たせる関数
 */
export const splitTextWithOverlap = (text, chunkSize = 1000, overlap = 200) => {
    if (!text) return [];
    const chunks = [];
    let startIndex = 0;
    while (startIndex < text.length) {
        let endIndex = startIndex + chunkSize;
        if (endIndex > text.length) endIndex = text.length;
        chunks.push(text.slice(startIndex, endIndex));
        if (endIndex === text.length) break;
        startIndex = endIndex - overlap;
    }
    return chunks;
};

/**
 * データの保存処理（Edge Functionを呼び出す）
 * ※ 直接DBインサートではなく、embed-text APIを呼ぶ
 */
export const saveDocument = async (supabase, file, text, userId) => {
    // 1. テキストを分割
    const rawChunks = splitTextWithOverlap(text);

    // 2. 送信用の形式に整形
    const chunks = rawChunks.map((c, index) => ({
        content: c,
        page: 1 // 将来的にPDF解析結果からページ数を取得して入れる
    }));

    // 3. Python Backendを呼び出し
    console.log('Sending chunks to Python Backend:', chunks.length);

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    const response = await fetch(`${API_BASE_URL}/embed_document`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            title: file.name,
            source_type: 'file',
            chunks: chunks,
            user_id: userId
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend Error: ${errorText}`);
    }

    return await response.json();
};
