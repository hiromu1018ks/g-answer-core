import React from 'react';
import { Toaster } from 'react-hot-toast';

const Layout = ({ children }) => {
    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans text-slate-900">
            <Toaster position="bottom-right" />
            {children}
        </div>
    );
};

export default Layout;
