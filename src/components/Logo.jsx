import React from 'react';
import { useSettings } from '../hooks/useSettings';

const Logo = ({ className = '', compact = false }) => {
  const { companyName } = useSettings();
  const initial = companyName.charAt(0) || 'D';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,rgba(78,205,196,0.9),rgba(255,138,61,0.95))] shadow-[0_16px_32px_rgba(0,0,0,0.28)]">
        <span className="font-['Space_Grotesk'] text-lg font-bold text-slate-950">
          {initial}
        </span>
      </div>

      {!compact && (
        <div className="min-w-0">
          <div className="surface-label mb-1">Delivery OS</div>
          <span className="block truncate font-['Space_Grotesk'] text-lg font-bold text-white">
            {companyName}
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
