import React from 'react';

interface Props {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

const AutoSaveToggle: React.FC<Props> = ({ enabled, onChange }) => (
  <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={enabled}
      onChange={(e) => onChange(e.target.checked)}
      className="m-0 cursor-pointer accent-indigo-500"
    />
    Auto-save
  </label>
);

export default AutoSaveToggle;
