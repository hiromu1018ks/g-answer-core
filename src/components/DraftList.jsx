import React, { useEffect, useState } from 'react';
import { getDrafts, deleteDraft } from '../utils/api';
import { supabase } from '../utils/supabaseClient';
import { FileText, Trash2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const DraftList = ({ onSelectDraft }) => {
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchDrafts = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const data = await getDrafts(session.user.id);
            setDrafts(data);
        } catch (error) {
            console.error('Error fetching drafts:', error);
            toast.error('下書きの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDrafts();
    }, []);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('この下書きを削除してもよろしいですか？')) return;

        try {
            await deleteDraft(id);
            setDrafts(drafts.filter(d => d.id !== id));
            toast.success('下書きを削除しました');
        } catch (error) {
            console.error('Error deleting draft:', error);
            toast.error('削除に失敗しました');
        }
    };

    if (loading) {
        return <div className="p-4 text-center text-slate-400">読み込み中...</div>;
    }

    if (drafts.length === 0) {
        return <div className="p-4 text-center text-slate-400">保存された下書きはありません</div>;
    }

    return (
        <div className="space-y-2 p-2">
            {drafts.map((draft) => (
                <div
                    key={draft.id}
                    onClick={() => onSelectDraft(draft)}
                    className="group bg-white p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all relative"
                >
                    <div className="flex items-start gap-3">
                        <div className="mt-1 text-indigo-500">
                            <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-slate-700 truncate mb-1">
                                {draft.question || '（質問なし）'}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Clock size={12} />
                                <span>{new Date(draft.updated_at).toLocaleString()}</span>
                            </div>
                        </div>
                        <button
                            onClick={(e) => handleDelete(e, draft.id)}
                            className="text-slate-300 hover:text-red-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="削除"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default DraftList;
