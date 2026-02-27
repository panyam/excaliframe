import React, { useState, useCallback } from 'react';

interface Props {
  initialTitle: string;
  onRename: (title: string) => void;
}

/** Inline editable drawing title. Click to edit, blur/Enter to commit. */
const DrawingTitle: React.FC<Props> = ({ initialTitle, onRename }) => {
  const [title, setTitle] = useState(initialTitle);
  const [isEditing, setIsEditing] = useState(false);

  const commit = useCallback((value: string) => {
    const trimmed = value.trim() || 'Untitled Drawing';
    setTitle(trimmed);
    setIsEditing(false);
    onRename(trimmed);
  }, [onRename]);

  if (isEditing) {
    return (
      <input
        defaultValue={title}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            (e.target as HTMLInputElement).value = title;
            (e.target as HTMLInputElement).blur();
          }
        }}
        style={{
          fontSize: '14px',
          fontWeight: 500,
          fontFamily: 'inherit',
          color: '#1f2937',
          background: 'white',
          border: '1px solid #6366f1',
          borderRadius: '4px',
          padding: '2px 8px',
          outline: 'none',
          minWidth: '160px',
        }}
        autoFocus
      />
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      style={{
        fontSize: '14px',
        fontWeight: 500,
        fontFamily: 'inherit',
        color: '#6b7280',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: '4px',
        padding: '2px 8px',
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = '#1f2937';
        e.currentTarget.style.borderColor = '#d1d5db';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = '#6b7280';
        e.currentTarget.style.borderColor = 'transparent';
      }}
    >
      {title}
    </button>
  );
};

export default DrawingTitle;
