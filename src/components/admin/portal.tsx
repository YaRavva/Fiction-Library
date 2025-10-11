import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
  container?: Element | DocumentFragment | null;
}

export const Portal: React.FC<PortalProps> = ({ children, container }) => {
  const [mounted, setMounted] = useState(false);
  const portalContainerRef = useRef<Element | DocumentFragment | null>(null);

  useEffect(() => {
    // Если контейнер не передан, создаем новый div в body
    if (!container) {
      const div = document.createElement('div');
      div.className = 'portal-container';
      document.body.appendChild(div);
      portalContainerRef.current = div;
    } else {
      portalContainerRef.current = container;
    }
    
    setMounted(true);

    // Очистка при размонтировании
    return () => {
      if (!container && portalContainerRef.current) {
        document.body.removeChild(portalContainerRef.current as HTMLDivElement);
      }
      setMounted(false);
    };
  }, [container]);

  if (!mounted) {
    return null;
  }

  return createPortal(children, portalContainerRef.current!);
};