import React from 'react';
import { useSettings } from '../hooks/useSettings';

const Logo = ({ className = '' }) => {
  const { companyName } = useSettings();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-xl">
          {companyName.charAt(0)}
        </span>
      </div>
      <span className="text-xl font-bold text-white">
        {companyName}
      </span>
    </div>
  );
};

export default Logo;
