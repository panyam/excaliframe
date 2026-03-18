import { requestConfluence, invoke } from '@forge/bridge';

const LOG_PREFIX = '[V2-ATTACH]';

/**
 * Toggle between bridge (requestConfluence) and resolver (invoke) modes.
 * Set via window.__excaliframeUseResolver = true/false in console,
 * or it defaults to 'resolver' since bridge mode gets 401.
 */
function useResolver(): boolean {
  return (window as any).__excaliframeUseResolver !== false;
}

// ── Diagnostic ──────────────────────────────────────────────

/**
 * Diagnostic: test both bridge and resolver modes.
 * Call from console: window.__excaliframeDiag('PAGE_ID')
 */
(window as any).__excaliframeDiag = async (pageId: string) => {
  console.log(`${LOG_PREFIX} DIAG: testing BRIDGE mode (requestConfluence)`);
  try {
    const r1 = await requestConfluence(`/wiki/rest/api/content/${pageId}`, { method: 'GET' });
    console.log(`${LOG_PREFIX} DIAG [bridge]: GET content → ${r1.status}`);
  } catch (e) {
    console.error(`${LOG_PREFIX} DIAG [bridge]: GET content failed:`, e);
  }
  try {
    const r2 = await requestConfluence(`/wiki/rest/api/content/${pageId}/child/attachment`, { method: 'GET' });
    console.log(`${LOG_PREFIX} DIAG [bridge]: GET attachments → ${r2.status}`);
  } catch (e) {
    console.error(`${LOG_PREFIX} DIAG [bridge]: GET attachments failed:`, e);
  }

  console.log(`${LOG_PREFIX} DIAG: testing RESOLVER mode (invoke)`);
  try {
    const result = await invoke<Record<string, any>>('diagTest', { pageId });
    console.log(`${LOG_PREFIX} DIAG [resolver]:`, result);
  } catch (e) {
    console.error(`${LOG_PREFIX} DIAG [resolver]: invoke failed:`, e);
  }

  console.log(`${LOG_PREFIX} DIAG: current mode = ${useResolver() ? 'RESOLVER' : 'BRIDGE'}`);
  console.log(`${LOG_PREFIX} DIAG: switch with window.__excaliframeUseResolver = true/false`);
};

// ── Bridge mode (direct requestConfluence) ──────────────────

async function bridgeUpload(pageId: string, filename: string, jsonContent: string): Promise<void> {
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const form = new FormData();
  form.append('file', blob, filename);

  const resp = await requestConfluence(
    `/wiki/rest/api/content/${pageId}/child/attachment`,
    {
      method: 'PUT',
      headers: { 'X-Atlassian-Token': 'nocheck' },
      body: form,
    },
  );
  if (!resp.ok) {
    throw new Error(`Bridge upload failed: ${resp.status} ${resp.statusText}`);
  }
}

async function bridgeDownload(pageId: string, filename: string): Promise<string | null> {
  const findResp = await requestConfluence(
    `/wiki/rest/api/content/${pageId}/child/attachment?filename=${encodeURIComponent(filename)}`,
    { method: 'GET' },
  );
  if (!findResp.ok) return null;

  const findData = await findResp.json();
  if (!findData.results || findData.results.length === 0) return null;

  const downloadPath = findData.results[0]._links?.download;
  if (!downloadPath) return null;

  const dlResp = await requestConfluence(`/wiki${downloadPath}`, { method: 'GET' });
  if (!dlResp.ok) return null;
  return dlResp.text();
}

// ── Resolver mode (invoke → server-side @forge/api) ─────────

async function resolverUpload(pageId: string, filename: string, jsonContent: string): Promise<void> {
  const result = await invoke<{ success: boolean; error?: string }>('uploadAttachment', {
    pageId,
    filename,
    content: jsonContent,
  });
  if (!result.success) {
    throw new Error(`Resolver upload failed: ${result.error}`);
  }
}

async function resolverDownload(pageId: string, filename: string): Promise<string | null> {
  const result = await invoke<{ success: boolean; content: string | null }>('downloadAttachment', {
    pageId,
    filename,
  });
  if (!result.success) return null;
  return result.content;
}

// ── Public API (dispatches to bridge or resolver) ───────────

export async function uploadAttachment(
  pageId: string,
  filename: string,
  jsonContent: string,
): Promise<void> {
  const mode = useResolver() ? 'resolver' : 'bridge';
  const sizeKB = (jsonContent.length / 1024).toFixed(1);
  console.log(`${LOG_PREFIX} uploadAttachment [${mode}]: pageId=${pageId}, filename=${filename}, size=${sizeKB}KB`);

  if (useResolver()) {
    await resolverUpload(pageId, filename, jsonContent);
  } else {
    await bridgeUpload(pageId, filename, jsonContent);
  }
  console.log(`${LOG_PREFIX} uploadAttachment [${mode}]: success`);
}

export async function downloadAttachment(
  pageId: string,
  filename: string,
): Promise<string | null> {
  const mode = useResolver() ? 'resolver' : 'bridge';
  console.log(`${LOG_PREFIX} downloadAttachment [${mode}]: pageId=${pageId}, filename=${filename}`);

  let result: string | null;
  if (useResolver()) {
    result = await resolverDownload(pageId, filename);
  } else {
    result = await bridgeDownload(pageId, filename);
  }

  if (result) {
    console.log(`${LOG_PREFIX} downloadAttachment [${mode}]: got ${(result.length / 1024).toFixed(1)}KB`);
  } else {
    console.warn(`${LOG_PREFIX} downloadAttachment [${mode}]: not found`);
  }
  return result;
}
