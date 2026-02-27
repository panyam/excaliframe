/** @jsxImportSource jsx-dom */

import { PlaygroundStore, StoredDrawing } from '@excaliframe/hosts/playground-store';

declare global {
  interface Window {
    PLAYGROUND_DRAWING_ID?: string;
  }
}

/**
 * PlaygroundDetailPage renders the drawing preview/detail view.
 *
 * Reads the drawing ID from window.PLAYGROUND_DRAWING_ID (set by the
 * Go template), loads the drawing from IndexedDB, and renders a
 * preview card with title, date, tool badge, PNG preview, and actions.
 */
class PlaygroundDetailPage {
  private store: PlaygroundStore;
  private drawingId: string;
  private container: HTMLElement;
  private loading: HTMLElement | null;

  constructor() {
    this.store = new PlaygroundStore();
    this.drawingId = window.PLAYGROUND_DRAWING_ID || '';
    this.container = document.getElementById('playground-detail-root')!;
    this.loading = document.getElementById('detail-loading');
  }

  async init(): Promise<void> {
    if (!this.drawingId) {
      window.location.href = '/playground/';
      return;
    }

    const drawing = await this.store.getById(this.drawingId);
    this.hideLoading();

    if (!drawing) {
      this.renderNotFound();
      return;
    }

    this.renderDetail(drawing);
  }

  private renderDetail(d: StoredDrawing): void {
    const previewSrc = this.getPreviewSrc(d);

    const view = (
      <div className="space-y-6">
        {/* Title and actions bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{d.title || 'Untitled Drawing'}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                {d.envelope?.tool || 'excalidraw'}
              </span>
              {d.envelope?.updatedAt && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Last modified {this.formatDate(d.envelope.updatedAt)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/playground/${d.id}/edit`}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </a>
            <button
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              onClick={() => this.deleteDrawing(d)}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>

        {/* Preview card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          {previewSrc
            ? <img src={previewSrc} alt={d.title} className="w-full max-h-[600px] object-contain bg-white dark:bg-gray-700 p-4" />
            : (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-500">
                <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                </svg>
                <p className="text-sm">No preview available. Open the editor to start drawing.</p>
              </div>
            )
          }
        </div>
      </div>
    );

    this.container.appendChild(view);
  }

  private renderNotFound(): void {
    const view = (
      <div className="text-center py-16">
        <svg className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">Drawing not found</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          This drawing may have been deleted or the link is invalid.
        </p>
        <a
          href="/playground/"
          className="mt-6 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Back to drawings
        </a>
      </div>
    );

    this.container.appendChild(view);
  }

  private async deleteDrawing(d: StoredDrawing): Promise<void> {
    if (!confirm(`Delete "${d.title || 'this drawing'}"? This cannot be undone.`)) return;
    await this.store.delete(d.id);
    window.location.href = '/playground/';
  }

  private hideLoading(): void {
    this.loading?.classList.add('hidden');
  }

  private getPreviewSrc(drawing: StoredDrawing): string {
    const preview = drawing.envelope?.preview;
    if (!preview) return '';
    if (preview.startsWith('data:')) return preview;
    return `data:image/png;base64,${preview}`;
  }

  private formatDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const page = new PlaygroundDetailPage();
  page.init();
});
