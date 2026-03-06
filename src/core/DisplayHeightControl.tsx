import React from 'react';

interface Props {
  value: number;           // 0 = auto
  onChange: (h: number) => void;
}

const PRESETS: { label: string; value: number }[] = [
  { label: 'Auto', value: 0 },
  { label: 'Small', value: 200 },
  { label: 'Medium', value: 400 },
  { label: 'Large', value: 600 },
];

const DisplayHeightControl: React.FC<Props> = ({ value, onChange }) => {
  const matchedPreset = PRESETS.find((p) => p.value === value);
  const isCustom = !matchedPreset && value > 0;
  const selectValue = isCustom ? 'custom' : String(value);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === 'custom') {
      onChange(value || 400); // default custom to 400 if currently auto
    } else {
      onChange(Number(v));
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '12px', color: '#6b778c', whiteSpace: 'nowrap' }}>
        Display height:
      </span>
      <select
        value={selectValue}
        onChange={handleSelectChange}
        style={{
          fontSize: '12px',
          padding: '2px 4px',
          border: '1px solid #dfe1e6',
          borderRadius: '3px',
          backgroundColor: '#fff',
          color: '#172b4d',
          cursor: 'pointer',
        }}
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={String(p.value)}>{p.label}</option>
        ))}
        <option value="custom">Custom</option>
      </select>
      {(isCustom || selectValue === 'custom') && (
        <>
          <input
            type="number"
            min={50}
            max={2000}
            value={value}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n) && n > 0) onChange(n);
            }}
            style={{
              width: '60px',
              fontSize: '12px',
              padding: '2px 4px',
              border: '1px solid #dfe1e6',
              borderRadius: '3px',
              color: '#172b4d',
            }}
          />
          <span style={{ fontSize: '12px', color: '#6b778c' }}>px</span>
        </>
      )}
    </div>
  );
};

export default DisplayHeightControl;
