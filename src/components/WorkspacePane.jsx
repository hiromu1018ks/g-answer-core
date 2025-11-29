import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Send, Save } from 'lucide-react';
import { generateAnswer } from '../utils/api';
import toast from 'react-hot-toast';

const WorkspacePane = ({ onReferencesUpdate }) => {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        if (!question.trim()) return;
        setLoading(true);
        setAnswer('');
        onReferencesUpdate([]);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error("ログインしてください");
                return;
            }

            // Call Python Backend for RAG generation
            const data = await generateAnswer(question, session.user.id);

            setAnswer(data.answer);
            if (data.references) {
                onReferencesUpdate(data.references);
            }
            toast.success("回答を作成しました");
        } catch (error) {
            console.error('Error generating answer:', error);
            setAnswer('Error generating answer: ' + error.message);
            toast.error("回答の作成に失敗しました: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!answer) return;
        // Implementation for saving draft to 'drafts' table
        // For now, just a placeholder
        alert('Save draft functionality to be implemented.');
    };

    return (
        <div className="flex-1 h-full p-8 overflow-y-auto flex flex-col items-center bg-slate-50/50">
            <h2 className="text-2xl font-bold text-slate-800 mb-8 self-start max-w-3xl mx-auto w-full">答弁作成ワークスペース</h2>

            <div className="w-full max-w-3xl mb-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">質問通告内容</h3>
                    <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="ここに質問内容を入力してください..."
                        rows={3}
                        className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none text-slate-700"
                    />
                    <div className="flex justify-end mt-3">
                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            <Send size={16} />
                            {loading ? 'AIが起案中...' : 'AIで起案する'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-3xl flex-1 min-h-[600px] bg-white rounded-xl shadow-md p-10 relative mb-8">
                <div className="absolute top-0 right-0 p-4">
                    <button
                        onClick={handleSaveDraft}
                        disabled={!answer}
                        className="text-slate-400 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition-colors"
                        title="保存"
                    >
                        <Save size={20} />
                    </button>
                </div>

                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6 border-b border-slate-100 pb-2">答弁書ドラフト</h3>

                <div className="prose prose-slate max-w-none">
                    {answer ? (
                        <div className="whitespace-pre-wrap leading-relaxed text-slate-800 text-lg break-words">
                            {answer}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                            <div className="bg-slate-50 p-4 rounded-full mb-4">
                                <Send size={32} />
                            </div>
                            <p>質問を入力して「AIで起案する」を押してください</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorkspacePane;
