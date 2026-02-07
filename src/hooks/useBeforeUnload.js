import { useEffect } from 'react';

/**
 * Warn user before leaving page when a session is in progress.
 * @param {boolean} active - Whether to show the warning
 */
export function useBeforeUnload(active) {
  useEffect(() => {
    if (!active) return;

    const handler = (e) => {
      e.preventDefault();
      // Modern browsers ignore custom messages but still show a generic prompt
      e.returnValue = 'You have an exercise session in progress. Are you sure you want to leave?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);
}
