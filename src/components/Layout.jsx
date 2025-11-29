import React from 'react';

const Layout = ({ children }) => {
    return (
        <div className="flex h-screen w-full bg-slate-50 text-slate-800 overflow-hidden">
            {children}
        </div>
    );
};

export default Layout;
