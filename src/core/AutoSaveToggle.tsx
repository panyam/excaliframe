import React from 'react';

interface Props {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

const AutoSaveToggle: React.FC<Props> = ({ enabled, onChange }) => (
  <label style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#172b4d',
    cursor: 'pointer',
    userSelect: 'none',
  }}>
    <input
      type="checkbox"
      checked={enabled}
      onChange={(e) => onChange(e.target.checked)}
      style={{ margin: 0, cursor: 'pointer' }}
    />
    Auto-save
  </label>
);

export default AutoSaveToggle;
