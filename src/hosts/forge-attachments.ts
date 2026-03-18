import { requestConfluence, invoke } from '@forge/bridge';

const LOG_PREFIX = '[V2-ATTACH]';

/**
 * Toggle between bridge (requestConfluence) and resolver (invoke) modes.
 * Set via window.__excaliframeUseResolver = true/false in console,
 * or it defaults to 'resolver' since bridge mode gets 401.
 */
function useResolver(): boolean {
  return (window as any).__excaliframeUseResolver === true;
}

// ── Diagnostic ──────────────────────────────────────────────

/**
 * Diagnostic: test both bridge and resolver modes.
 * Call from console: window.__excaliframeDiag('PAGE_ID')
 */
(window as any).__excaliframeDiag = async (pageId: string) => {
  // Test all path combinations to find what works
  const paths = [
    { label: 'v1 /wiki/', content: `/wiki/rest/api/content/${pageId}`, attach: `/wiki/rest/api/content/${pageId}/child/attachment` },
    { label: 'v1 no /wiki/', content: `/rest/api/content/${pageId}`, attach: `/rest/api/content/${pageId}/child/attachment` },
    { label: 'v2 /wiki/', content: `/wiki/api/v2/pages/${pageId}`, attach: `/wiki/api/v2/pages/${pageId}/attachments` },
    { label: 'v2 no /wiki/', content: `/api/v2/pages/${pageId}`, attach: `/api/v2/pages/${pageId}/attachments` },
  ];

  console.log(`${LOG_PREFIX} DIAG: testing all path combos for pageId=${pageId}`);
  for (const p of paths) {
    try {
      const r1 = await requestConfluence(p.content, { method: 'GET' });
      const status1 = r1.status;
      let title = '';
      if (r1.ok) { try { const b = await r1.json(); title = b.title || b.name || ''; } catch {} }
      console.log(`${LOG_PREFIX} DIAG [${p.label}]: GET content → ${status1}${title ? ` "${title}"` : ''}`);
    } catch (e: any) {
      console.error(`${LOG_PREFIX} DIAG [${p.label}]: GET content → ERROR: ${e.message}`);
    }
    try {
      const r2 = await requestConfluence(p.attach, { method: 'GET' });
      const status2 = r2.status;
      let count = '';
      if (r2.ok) { try { const b = await r2.json(); count = ` (${b.results?.length ?? b.length ?? '?'} attachments)`; } catch {} }
      console.log(`${LOG_PREFIX} DIAG [${p.label}]: GET attachments → ${status2}${count}`);
    } catch (e: any) {
      console.error(`${LOG_PREFIX} DIAG [${p.label}]: GET attachments → ERROR: ${e.message}`);
    }
  }

  console.log(`${LOG_PREFIX} DIAG: current mode = ${useResolver() ? 'RESOLVER' : 'BRIDGE'}`);
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
