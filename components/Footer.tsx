
import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full py-8 text-center mt-auto">
      <p className="text-sm font-medium text-slate-400 dark:text-slate-500 transition-colors">
        © {currentYear} Sayuna AI. All rights reserved.
      </p>
      <p className="text-sm font-bold text-indigo-400 mt-1 tracking-wide">
        JOHN M. NAVARRO
      </p>
    </footer>
  );
};

export default Footer;
