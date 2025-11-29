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

  if (!session) {
    return <Auth />;
  }

  return (
    <Layout>
      <KnowledgePane onSelectDocument={handleSelectDocument} />
      <WorkspacePane onReferencesUpdate={handleReferencesUpdate} />
      <PreviewPane references={references} />
    </Layout>
  );
}

export default App;
