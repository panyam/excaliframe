import React from 'react';
import { CollabState } from './useCollaboration';

export interface CollabBadgeProps {
  state: CollabState;
  onClick?: () => void;
}

/** Simple people/users SVG icon (two silhouettes). */
const PeopleIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="align-middle">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const CollabBadge: React.FC<CollabBadgeProps> = ({ state, onClick }) => {
  const { isConnected, isConnecting, error, peers } = state;

  let content: React.ReactNode;
  let title: string;
  let colorClasses: string;

  if (error) {
    content = <><PeopleIcon /> <span className="ml-1">!</span></>;
    title = error;
    colorClasses = 'bg-red-500/10 text-red-500 dark:text-red-400';
  } else if (isConnecting) {
    content = <><PeopleIcon /> <span className="ml-1">&hellip;</span></>;
    title = 'Connecting...';
    colorClasses = 'bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400';
  } else if (isConnected) {
    const count = peers.size;
    content = <><span className="mr-1">{count}</span><PeopleIcon /></>;
    title = `${count} peer${count !== 1 ? 's' : ''}`;
    colorClasses = 'bg-green-500/10 text-green-600 dark:text-green-400';
  } else {
    content = <PeopleIcon size={18} />;
    title = 'Collaborate';
    colorClasses = 'bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300';
  }

  return (
    <div
      data-testid="collab-badge"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-[13px] font-medium cursor-pointer ${colorClasses}`}
    >
      {content}
    </div>
  );
};

export default CollabBadge;
