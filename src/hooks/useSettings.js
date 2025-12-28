import { useState, useEffect } from 'react';

export const useSettings = () => {
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    // Cargar nombre de empresa desde variable de entorno
    const name = import.meta.env.VITE_COMPANY_NAME || 'DomicilioX';
    setCompanyName(name);
  }, []);

  return {
    companyName
  };
};
