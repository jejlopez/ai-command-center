import React from 'react';

const SyncStatus = () => {
  return (
    <div className="flex items-center space-x-2 text-sm font-medium text-emerald-400 p-2 bg-emerald-400/10 rounded-lg border border-emerald-400/20">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span>System Synced</span>
    </div>
  );
};

export default SyncStatus;
