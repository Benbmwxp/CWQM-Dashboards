import { useEffect, useState } from 'react';
import { DateRangeField, FilterBar, FormField, SearchField, SelectField } from '@severn-trent/cwqm-design-system';
import type { Site } from '../api/contract';
import { daysBetween } from '../lib/dates';

interface Props {
  site?: { sites: Site[]; value?: string; onChange: (id: string | undefined) => void; allowAll?: boolean };
  parameter?: { parameters: string[]; value?: string; onChange: (p: string | undefined) => void };
  dates: { from: string; to: string; onChange: (r: { from: string; to: string }) => void };
  code?: { value?: string; onChange: (c: string | undefined) => void };
}

/** Site, parameter, date range and concern code. Each change applies straight away, as in the designs. */
export function QualityFilters({ site, parameter, dates, code }: Props) {
  const name = (id?: string) => site?.sites.find((s) => s.id === id)?.name ?? '';
  const [text, setText] = useState(name(site?.value));
  useEffect(() => setText(name(site?.value)), [site?.value, site?.sites.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rangeError, setRangeError] = useState('');

  const onSite = (v: string) => {
    setText(v);
    const match = site?.sites.find((s) => s.name.toLowerCase() === v.trim().toLowerCase());
    if (match) site?.onChange(match.id);
    else if (!v.trim() && site?.allowAll) site.onChange(undefined);
  };

  return (
    <div>
      <FilterBar>
        {site && (
          <FormField label="Site">
            <SearchField value={text} onChange={onSite} clearable options={site.sites.map((s) => s.name)} placeholder={site.allowAll ? 'All sites' : 'Search site…'} />
          </FormField>
        )}
        {parameter && (
          <FormField label="Parameter">
            <SelectField value={parameter.value ?? ''} onChange={(e) => parameter.onChange(e.target.value || undefined)}
              options={[{ value: '', label: 'All' }, ...parameter.parameters.map((p) => ({ value: p, label: p }))]} />
          </FormField>
        )}
        <FormField label="Date range">
          <DateRangeField from={dates.from} to={dates.to} onChange={(r) => {
            if (!r.from || !r.to || r.from > r.to) return setRangeError('"From" must be on or before "To".');
            if (daysBetween(r.from, r.to) > 180) return setRangeError('Choose 180 days or fewer.');
            setRangeError('');
            dates.onChange(r);
          }} />
        </FormField>
        {code && (
          <FormField label="Concern Code">
            <SelectField value={code.value ?? ''} onChange={(e) => code.onChange(e.target.value || undefined)}
              options={[{ value: '', label: 'All' }, { value: 'Flatline', label: 'Flatline' }, { value: 'Impossible value', label: 'Impossible value' }]} />
          </FormField>
        )}
      </FilterBar>
      {site && text && !site.sites.some((s) => s.name.toLowerCase() === text.trim().toLowerCase()) && (
        <p role="alert" className="mt-xs text-sm text-feedback-negative">Pick a site from the list.</p>
      )}
      {rangeError && <p role="alert" className="mt-xs text-sm text-feedback-negative">{rangeError}</p>}
    </div>
  );
}
