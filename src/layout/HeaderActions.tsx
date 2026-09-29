import { useState } from 'react';
import { Download, Moon, Share2, Sun } from 'lucide-react';
import { Button, IconButton, PeriodChip } from '@severn-trent/cwqm-design-system';
import { daysBetween } from '../lib/dates';
import { fmtDay } from '../lib/format';
import { useTheme } from '../lib/theme';

/** Optional period chip, Share (copies the URL, which holds every filter), Export and the theme switch. */
export function HeaderActions({ period, onExport, exportDisabled }: { period?: { from: string; to: string }; onExport?: () => void; exportDisabled?: boolean } = {}) {
  const { theme, toggle } = useTheme();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked - the URL is still shareable from the address bar */ }
  };
  const days = period ? daysBetween(period.from, period.to) : 0;
  return (
    <>
      {period && <PeriodChip label="Selected period" value={`${fmtDay(period.from)} - ${fmtDay(period.to)}`} detail={`(${days} day${days === 1 ? '' : 's'})`} />}
      <Button variant="secondary" size="lg" onClick={share} aria-live="polite"><Share2 aria-hidden />{copied ? 'Link copied' : 'Share'}</Button>
      {onExport && <Button variant="secondary" size="lg" onClick={onExport} disabled={exportDisabled}><Download aria-hidden />Export</Button>}
      <IconButton aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'} className="size-12" onClick={toggle}>
        {theme === 'light' ? <Moon aria-hidden /> : <Sun aria-hidden />}
      </IconButton>
    </>
  );
}
