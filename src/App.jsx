import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import Layout from './components/Layout';
import KnowledgePane from './components/KnowledgePane';
import WorkspacePane from './components/WorkspacePane';
import PreviewPane from './components/PreviewPane';
import Auth from './components/Auth';

function App() {
  const [session, setSession] = useState(null);
  const [references, setReferences] = useState([]);

  const [selectedDraft, setSelectedDraft] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSelectDocument = (doc) => {
    console.log('Selected document:', doc);
  };

  const handleReferencesUpdate = (refs) => {
    setReferences(refs);
  };

  const handleSelectDraft = (draft) => {
    setSelectedDraft(draft);
    // Also update references if the draft has them
    // Note: The draft object from DB has referenced_section_ids.
    // We might need to fetch the actual sections if we want to show them in PreviewPane immediately.
    // For now, let's just pass the draft to WorkspacePane to load the text.
    // If we want to show references in PreviewPane, we'd need to fetch them by ID.
    // Let's assume WorkspacePane handles the text loading.
  };

  if (!session) {
    return <Auth />;
  }

  return (
    <Layout>
      <KnowledgePane
        onSelectDocument={handleSelectDocument}
        onSelectDraft={handleSelectDraft}
      />
      <WorkspacePane
        onReferencesUpdate={handleReferencesUpdate}
        initialDraft={selectedDraft}
      />
      <PreviewPane references={references} />
    </Layout>
  );
}

export default App;
