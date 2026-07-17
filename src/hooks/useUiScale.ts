import { useEffect, useState } from 'react';

// BGaming-style uniform stage scaling: below the base design size the whole
// control cluster scales as one unit (like the game stage in BGaming titles),
// keeping every proportion identical instead of reflowing per-element.
export function useUiScale(baseW: number, baseH: number): number {
  const calc = () =>
    Math.min(1, window.innerWidth / baseW, window.innerHeight / baseH);
  const [scale, setScale] = useState(calc);
  useEffect(() => {
    const onResize = () => setScale(calc());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseW, baseH]);
  return scale;
}
