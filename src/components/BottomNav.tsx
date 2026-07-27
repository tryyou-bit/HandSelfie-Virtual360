import React from 'react';

export type ActivePage = 'camera' | 'library' | 'converter' | 'security';

interface BottomNavProps {
  activeTab: ActivePage;
  setActiveTab: (tab: ActivePage) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 sm:px-8 py-3 bg-[#131313] border-t border-[#353534] select-none">
      <button
        onClick={() => setActiveTab('camera')}
        className={`px-4 sm:px-6 py-1.5 border text-xs font-semibold uppercase tracking-widest transition-all duration-150 ${
          activeTab === 'camera'
            ? 'bg-white text-[#131313] border-white shadow-md'
            : 'text-[#c4c7c8] border-[#444748] hover:bg-white hover:text-[#131313]'
        }`}
      >
        CAPTURE
      </button>

      <button
        onClick={() => setActiveTab('library')}
        className={`px-4 sm:px-6 py-1.5 border text-xs font-semibold uppercase tracking-widest transition-all duration-150 ${
          activeTab === 'library'
            ? 'bg-white text-[#131313] border-white shadow-md'
            : 'text-[#c4c7c8] border-[#444748] hover:bg-white hover:text-[#131313]'
        }`}
      >
        LIBRARY
      </button>

      <button
        onClick={() => setActiveTab('converter')}
        className={`px-4 sm:px-6 py-1.5 border text-xs font-semibold uppercase tracking-widest transition-all duration-150 ${
          activeTab === 'converter'
            ? 'bg-white text-[#131313] border-white shadow-md'
            : 'text-[#c4c7c8] border-[#444748] hover:bg-white hover:text-[#131313]'
        }`}
      >
        EDIT
      </button>

      <button
        onClick={() => setActiveTab('security')}
        className={`px-4 sm:px-6 py-1.5 border text-xs font-semibold uppercase tracking-widest transition-all duration-150 ${
          activeTab === 'security'
            ? 'bg-white text-[#131313] border-white shadow-md'
            : 'text-[#c4c7c8] border-[#444748] hover:bg-white hover:text-[#131313]'
        }`}
      >
        SET
      </button>
    </nav>
  );
};
