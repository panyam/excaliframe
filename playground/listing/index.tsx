/** @jsxImportSource jsx-dom */

import { PlaygroundStore, StoredDrawing, generateId } from '../../src/hosts/playground-store';

// TODO: Consider wrapping/re-exporting jsx-dom from @panyam/tsappkit so all
// goapplib projects share the same DOM JSX runtime without each needing a
// direct jsx-dom dependency.

/** Tool definition for the new-drawing modal */
interface ToolDef {
  id: string;
  label: string;
  icon: Node;
}

const TOOLS: ToolDef[] = [
  {
    id: 'excalidraw',
    label: 'Excalidraw',
    icon: (
      <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
  },
  // Future: { id: 'mermaid', label: 'Mermaid', icon: ... },
];

/**
 * PlaygroundListPage manages the drawing list page.
 *
 * The server renders the EntityListing skeleton (PageHeader, Controls,
 * Grid, Table, EmptyState) via goapplib templates — all three are always
 * present in the DOM. This class loads drawings from IndexedDB and
 * populates the grid/table containers, then toggles visibility between
 * the drawings and the empty state.
 */
class PlaygroundListPage {
  private store: PlaygroundStore;
  private drawings: StoredDrawing[] = [];

  // DOM references — populated from EntityListing-rendered elements
  private gridContainer!: HTMLElement;    // #drawings-grid (inner grid)
  private tableBody!: HTMLElement;        // <tbody> inside table
  private gridWrapper!: HTMLElement;      // #drawings-grid-wrapper
  private emptyState!: HTMLElement;       // #drawings-empty-state
  private loadingOverlay: HTMLElement | null;
  private toolModal: HTMLElement | null;

  constructor() {
    this.store = new PlaygroundStore();
    this.loadingOverlay = document.getElementById('drawings-loading');
    this.toolModal = document.getElementById('tool-modal');
  }

  async init(): Promise<void> {
    this.resolveContainers();
    this.wireEvents();
    this.populateToolGrid();

    try {
      this.drawings = await this.store.listAll();
    } catch (err) {
      console.error('Failed to load drawings:', err);
      this.drawings = [];
    }

    this.render();
    this.hideLoading();
  }

  /** Find the EntityListing-rendered containers in the DOM */
  private resolveContainers(): void {
    this.gridContainer = document.getElementById('drawings-grid')!;
    this.gridWrapper = document.getElementById('drawings-grid-wrapper')!;
    this.emptyState = document.getElementById('drawings-empty-state')!;

    const listView = document.getElementById('drawings-grid-list-view');
    this.tableBody = listView?.querySelector('tbody') as HTMLElement;
  }

  private wireEvents(): void {
    // Intercept the "New Drawing" create button (href="#new-drawing")
    document.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest('a[href="#new-drawing"]');
      if (link) {
        e.preventDefault();
        this.openToolModal();
        return;
      }

      const deleteBtn = (e.target as HTMLElement).closest('[data-playground-delete]') as HTMLElement | null;
      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = deleteBtn.dataset.playgroundDelete;
        if (id) this.deleteDrawing(id);
      }
    });

    // Tool modal close handlers
    document.getElementById('tool-modal-backdrop')?.addEventListener('click', () => this.closeToolModal());
    document.getElementById('tool-modal-close')?.addEventListener('click', () => this.closeToolModal());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.toolModal && !this.toolModal.classList.contains('hidden')) {
        this.closeToolModal();
      }
    });

    // Override EntityListing's server-side delete for client-side IndexedDB deletion
    (window as any).confirmEntityDelete = (_deleteUrl: string, id: string, name: string) => {
      if (!confirm(`Are you sure you want to delete "${name || 'this drawing'}"? This action cannot be undone.`)) {
        return;
      }
      this.deleteDrawing(id);
    };
  }

  // --- Tool selection modal ---

  private populateToolGrid(): void {
    const grid = document.getElementById('tool-grid');
    if (!grid) return;

    for (const tool of TOOLS) {
      grid.appendChild(this.toolButton(tool));
    }
  }

  private toolButton(tool: ToolDef): Node {
    return (
      <button
        className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
        onClick={() => this.createNewDrawing(tool.id)}
      >
        {tool.icon}
        <span className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
          {tool.label}
        </span>
      </button>
    );
  }

  private openToolModal(): void {
    this.toolModal?.classList.remove('hidden');
  }

  private closeToolModal(): void {
    this.toolModal?.classList.add('hidden');
  }

  // --- Rendering ---

  private render(): void {
    if (this.drawings.length === 0) {
      this.showEmptyState();
      return;
    }

    this.hideEmptyState();
    this.sortDrawings();
    this.renderGrid();
    this.renderTable();
  }

  private sortDrawings(): void {
    this.drawings.sort((a, b) => {
      const aDate = a.envelope?.updatedAt || '';
      const bDate = b.envelope?.updatedAt || '';
      return bDate.localeCompare(aDate);
    });
  }

  private renderGrid(): void {
    this.gridContainer.textContent = '';
    for (const d of this.drawings) {
      this.gridContainer.appendChild(this.gridCard(d));
    }
  }

  private gridCard(d: StoredDrawing): Node {
    const previewSrc = this.getPreviewSrc(d);

    return (
      <div
        id={`item-${d.id}`}
        className="entity-card group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600"
        data-entity-id={d.id}
      >
        <a href={`/playground/${d.id}/`} className="block relative">
          <div className="aspect-video w-full bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
            {previewSrc
              ? <img src={previewSrc} alt={d.title} className="w-full h-full object-contain" loading="lazy" />
              : <div className="flex items-center justify-center h-full">{placeholderIcon('w-16 h-16 text-indigo-200 dark:text-gray-600')}</div>
            }
          </div>
          <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-colors duration-200" />
        </a>

        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate flex-1 mr-2">
              <a href={`/playground/${d.id}/`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                {d.title || 'Untitled'}
              </a>
            </h3>
            {actionMenuButton(d)}
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3 min-h-[2.5rem]">
            {this.formatDate(d.envelope?.updatedAt)}
          </p>

          <div className="flex gap-2">
            <a
              href={`/playground/${d.id}/`}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              View
            </a>
            <a
              href={`/playground/${d.id}/edit`}
              className="hidden sm:hidden sm:group-hover:inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {editIcon()}
            </a>
          </div>
        </div>
      </div>
    );
  }

  private renderTable(): void {
    if (!this.tableBody) return;
    this.tableBody.textContent = '';
    for (const d of this.drawings) {
      this.tableBody.appendChild(this.tableRow(d));
    }
  }

  private tableRow(d: StoredDrawing): Node {
    const previewSrc = this.getPreviewSrc(d);

    return (
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
        <td className="px-6 py-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-gray-600 dark:to-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
              {previewSrc
                ? <img src={previewSrc} alt={d.title} className="h-12 w-12 rounded-lg object-cover" />
                : placeholderIcon('w-6 h-6 text-indigo-500 dark:text-indigo-400')
              }
            </div>
            <div className="ml-4">
              <a
                href={`/playground/${d.id}/`}
                className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {d.title || 'Untitled'}
              </a>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
          <p className="line-clamp-1">{this.formatDate(d.envelope?.updatedAt) || 'No date'}</p>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div className="flex items-center justify-end gap-2">
            <a
              href={`/playground/${d.id}/`}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              View
            </a>
            <a
              href={`/playground/${d.id}/edit`}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Edit
            </a>
            <button
              className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title="Delete"
              data-playground-delete={d.id}
            >
              {deleteIcon()}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  // --- Visibility ---

  private showEmptyState(): void {
    this.gridWrapper?.classList.add('hidden');
    this.emptyState?.classList.remove('hidden');
  }

  private hideEmptyState(): void {
    this.gridWrapper?.classList.remove('hidden');
    this.emptyState?.classList.add('hidden');

    // Trigger the EntityListing view toggle script to restore saved preference
    const savedView = localStorage.getItem('excaliframe:view-mode');
    if (savedView) {
      const btn = document.querySelector(`[data-view="${savedView}"]`) as HTMLElement | null;
      if (btn) btn.click();
    }
  }

  private hideLoading(): void {
    this.loadingOverlay?.classList.add('hidden');
  }

  // --- Actions ---

  private async createNewDrawing(toolId: string): Promise<void> {
    this.closeToolModal();
    const id = generateId();
    const now = new Date().toISOString();
    await this.store.save({
      id,
      title: 'Untitled Drawing',
      envelope: {
        tool: toolId,
        version: 1,
        data: '',
        createdAt: now,
        updatedAt: now,
      },
    });
    window.location.href = `/playground/${id}/edit`;
  }

  private async deleteDrawing(id: string): Promise<void> {
    await this.store.delete(id);
    this.drawings = this.drawings.filter((d) => d.id !== id);

    document.getElementById(`item-${id}`)?.remove();

    this.tableBody?.querySelectorAll('tr').forEach((row) => {
      if (row.querySelector(`[data-playground-delete="${id}"]`)) {
        row.remove();
      }
    });

    if (this.drawings.length === 0) this.showEmptyState();

    document.getElementById('entity-action-menu')?.classList.add('hidden');
  }

  // --- Helpers ---

  private getPreviewSrc(drawing: StoredDrawing): string {
    const preview = drawing.envelope?.preview;
    if (!preview) return '';
    if (preview.startsWith('data:')) return preview;
    return `data:image/png;base64,${preview}`;
  }

  private formatDate(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

// --- Shared TSX helper components ---

function placeholderIcon(className: string) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
        d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  );
}

function actionMenuButton(d: StoredDrawing) {
  return (
    <button
      className="entity-actions-btn p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
      title="Actions"
      data-view-url={`/playground/${d.id}/`}
      data-edit-url={`/playground/${d.id}/edit`}
      data-delete-url={`/playground/${d.id}/delete`}
      data-entity-name={d.title}
      data-entity-id={d.id}
      onClick={(e: Event) => (window as any).toggleEntityMenu(e.currentTarget, e)}
    >
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
      </svg>
    </button>
  );
}

function editIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function deleteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

// --- Bootstrap ---

document.addEventListener('DOMContentLoaded', () => {
  const page = new PlaygroundListPage();
  page.init();
});
