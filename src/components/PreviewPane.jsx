import React from 'react';

const PreviewPane = ({ references }) => {
    return (
        <div className="w-80 h-full bg-white border-l border-slate-200 p-6 flex flex-col overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="bg-amber-100 text-amber-600 p-1 rounded">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
                </span>
                AI校閲・リスク分析
            </h2>

            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                <p className="font-bold mb-1">AIアシスタント</p>
                <p>答弁案を作成すると、ここに根拠資料やリスク分析が表示されます。</p>
            </div>

            {references.length === 0 ? (
                <div className="text-center text-slate-400 mt-10">
                    <p className="text-sm">表示するデータがありません</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">根拠資料・引用</h3>
                    {references.map((ref, index) => (
                        <div key={index} className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm text-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                    類似度: {ref.similarity ? (ref.similarity * 100).toFixed(1) + '%' : 'N/A'}
                                </span>
                                <span className="text-slate-400 text-xs">ID: {ref.id.substring(0, 8)}...</span>
                            </div>
                            <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {ref.content}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PreviewPane;
