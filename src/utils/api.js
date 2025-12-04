const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Uploads and embeds a document.
 * @param {File} file - The file object.
 * @param {string} text - The extracted text content.
 * @param {string} userId - The user ID.
 * @returns {Promise<Object>} - The response data.
 */
export const embedDocument = async (file, text, userId) => {
    // Split text logic should ideally be here or passed in, but for now we keep it in textProcessor
    // and just handle the API call here if we refactor textProcessor later.
    // However, the current textProcessor calls fetch directly. 
    // We will refactor textProcessor to use this, or move the fetch logic here.
    // Let's assume textProcessor handles chunking and we just send the payload.

    // Actually, textProcessor.js currently does both chunking and sending.
    // We should probably move the fetch part here.

    throw new Error("Use textProcessor.saveDocument for now, or refactor it to use this.");
};

/**
 * Generates an answer using the RAG pipeline.
 * @param {string} question - The user's question.
 * @param {string} userId - The user ID.
 * @returns {Promise<Object>} - The generated answer and references.
 */
export const generateAnswer = async (question, userId) => {
    const response = await fetch(`${API_BASE_URL}/generate_answer`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            question,
            user_id: userId
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate answer');
    }

    return await response.json();
};

/**
 * Saves a draft to the database.
 * @param {string} userId - The user ID.
 * @param {string} question - The question text.
 * @param {string} answerBody - The answer text (HTML).
 * @param {Array} references - The referenced documents.
 * @param {string|null} draftId - The existing draft ID, if any.
 * @returns {Promise<Object>} - The saved draft data.
 */
export const saveDraft = async (userId, question, answerBody, references, draftId = null) => {
    // Extract IDs from references
    const referencedSectionIds = references.map(ref => ref.id);

    const payload = {
        user_id: userId,
        question: question,
        answer_body: answerBody,
        referenced_section_ids: referencedSectionIds,
        status: 'draft',
        updated_at: new Date().toISOString()
    };

    if (draftId) {
        payload.id = draftId;
    }

    const { data, error } = await import('./supabaseClient').then(m => m.supabase
        .from('drafts')
        .upsert(payload)
        .select()
        .single()
    );

    if (error) {
        throw new Error(error.message);
    }

    return data;
};

/**
 * Retrieves drafts for a user.
 * @param {string} userId - The user ID.
 * @returns {Promise<Array>} - The list of drafts.
 */
export const getDrafts = async (userId) => {
    const { data, error } = await import('./supabaseClient').then(m => m.supabase
        .from('drafts')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
    );

    if (error) {
        throw new Error(error.message);
    }

    return data;
};

/**
 * Deletes a draft.
 * @param {string} draftId - The draft ID.
 * @returns {Promise<void>}
 */
export const deleteDraft = async (draftId) => {
    const { error } = await import('./supabaseClient').then(m => m.supabase
        .from('drafts')
        .delete()
        .eq('id', draftId)
    );

    if (error) {
        throw new Error(error.message);
    }
};
