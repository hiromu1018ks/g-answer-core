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
