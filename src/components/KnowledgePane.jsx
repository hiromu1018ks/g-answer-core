import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { saveDocument } from '../utils/textProcessor';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { Upload, FileText, Trash2 } from 'lucide-react';

// Set PDF worker
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const KnowledgePane = ({ onSelectDocument }) => {
    const [documents, setDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) console.error('Error fetching documents:', error);
        else setDocuments(data);
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            let text = '';
            if (file.type === 'application/pdf') {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map((item) => item.str).join(' ') + '\n';
                }
            } else if (
                file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                text = result.value;
            } else {
                text = await file.text();
            }

            console.log('Extracted text length:', text.length);
            console.log('Extracted text preview:', text.substring(0, 100));

            if (!text || text.trim().length === 0) {
                alert('Warning: Extracted text is empty.');
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            await saveDocument(supabase, file, text, user.id);
            await fetchDocuments();
            alert('Document uploaded successfully!');
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Error uploading document: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this document?')) return;
        const { error } = await supabase.from('documents').delete().eq('id', id);
        if (error) console.error('Error deleting document:', error);
        else fetchDocuments();
    };

    return (
        <div className="w-80 h-full bg-slate-100/50 border-r border-slate-200 p-6 flex flex-col">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                ナレッジ・インポート
            </h2>

            <div className="mb-8">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">資料インポート</h3>
                <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-all group">
                    <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                    />
                    <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-indigo-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-700 mb-1">
                        {uploading ? '処理中...' : 'ここにファイルをドロップ'}
                    </span>
                    <span className="text-xs text-slate-400">PDF, Word, Text</span>
                </label>
            </div>

            <div className="flex-1 overflow-y-auto">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">過去資料・ナレッジ</h3>
                <div className="space-y-3">
                    {documents.map((doc) => (
                        <div key={doc.id} className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex items-start justify-between group">
                            <div
                                onClick={() => onSelectDocument(doc)}
                                className="cursor-pointer flex-1 flex items-start gap-3 min-w-0"
                            >
                                <div className="bg-indigo-50 p-2 rounded text-indigo-600 shrink-0">
                                    <FileText size={16} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">{doc.title}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {new Date(doc.created_at).toLocaleDateString('ja-JP')}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(doc.id)}
                                className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default KnowledgePane;
