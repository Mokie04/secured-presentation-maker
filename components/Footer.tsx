
import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full max-w-7xl mx-auto mt-10 mb-6 px-4 md:px-6">
      <div className="bg-surface rounded-3xl shadow-neumorphic-outset-sm border border-themed py-5 text-center">
      <p className="text-sm font-medium text-slate-400 dark:text-slate-500 transition-colors">
        © {currentYear} Sayuna AI. All rights reserved.
      </p>
      <p className="text-sm font-bold text-indigo-400 mt-1 tracking-wide">
        JOHN M. NAVARRO
      </p>
      </div>
    </footer>
  );
};

export default Footer;
