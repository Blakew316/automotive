import { useEffect, useState } from 'react';
import { loadIndex } from './catalog';

/**
 * Resolve an async value keyed by `key`. While a new key is loading the previous result is not
 * shown, so components never render stale data for a different vehicle.
 */
export function usePromise(factory, key) {
  const [state, setState] = useState({ key: null });
  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(factory)
      .then(
        (data) => alive && setState({ key, status: 'done', data }),
        (error) => alive && setState({ key, status: 'error', error }),
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? state : { status: 'loading' };
}

export const useCatalogIndex = () => usePromise(loadIndex, 'index');
