import { requestConfluence, invoke } from '@forge/bridge';

const LOG_PREFIX = '[V2-ATTACH]';

/**
 * Toggle between bridge (requestConfluence) and resolver (invoke) modes.
 * Set via window.__excaliframeUseResolver = true/false in console.
 * Defaults to bridge mode (returns false unless explicitly opted in).
 */
function useResolver(): boolean {
  return (window as any).__excaliframeUseResolver === true;
}

// ── Diagnostic (dev only) ───────────────────────────────────

if (process.env.NODE_ENV !== 'production') {
/**
 * Diagnostic: test both bridge and resolver modes.
 * Call from console: window.__excaliframeDiag('PAGE_ID')
 * Only available in development builds.
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
} // end dev-only diagnostic

// ── Bridge mode (direct requestConfluence) ──────────────────

async function bridgeUploadBlob(pageId: string, filename: string, blob: Blob): Promise<void> {
  // v1 PUT still works for uploads (only v1 GET is deprecated/410)
  const form = new FormData();
  form.append('file', blob, filename);

  console.log(`${LOG_PREFIX} bridge: PUT v1 attachment upload (${(blob.size / 1024).toFixed(1)}KB, ${blob.type})`);
  const resp = await requestConfluence(
    `/wiki/rest/api/content/${pageId}/child/attachment`,
    {
      method: 'PUT',
      headers: { 'X-Atlassian-Token': 'nocheck' },
      body: form,
    },
  );
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    console.error(`${LOG_PREFIX} bridge: PUT failed ${resp.status}`, body);
    throw new Error(`Bridge upload failed: ${resp.status} ${resp.statusText}`);
  }
}

async function bridgeUpload(pageId: string, filename: string, jsonContent: string): Promise<void> {
  const blob = new Blob([jsonContent], { type: 'application/json' });
  await bridgeUploadBlob(pageId, filename, blob);
}

async function bridgeDownload(pageId: string, filename: string): Promise<string | null> {
  // v2 GET for listing attachments
  console.log(`${LOG_PREFIX} bridge: GET v2 attachments for filename=${filename}`);
  const findResp = await requestConfluence(
    `/api/v2/pages/${pageId}/attachments?filename=${encodeURIComponent(filename)}`,
    { method: 'GET' },
  );
  if (!findResp.ok) {
    console.warn(`${LOG_PREFIX} bridge: v2 attachments list failed ${findResp.status}`);
    return null;
  }

  const findData = await findResp.json();
  const results = findData.results;
  if (!results || results.length === 0) {
    console.log(`${LOG_PREFIX} bridge: no attachment found for ${filename}`);
    return null;
  }

  const attachment = results[0];
  const attachmentId = attachment.id;
  console.log(`${LOG_PREFIX} bridge: found attachment id=${attachmentId}, downloading via v1...`);

  // v2 downloadLink goes through api.atlassian.com which requestConfluence can't auth (401).
  // v1 download path works reliably — v1 content *listing* is deprecated (410) but
  // the attachment *download* endpoint still works.
  const dlResp = await requestConfluence(
    `/wiki/rest/api/content/${pageId}/child/attachment/${attachmentId}/download`,
    { method: 'GET' },
  );
  if (!dlResp.ok) {
    console.error(`${LOG_PREFIX} bridge: v1 download failed ${dlResp.status}`);
    return null;
  }
  console.log(`${LOG_PREFIX} bridge: download succeeded`);
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

// ── Binary blob support (V3 preview attachments) ─────────

/**
 * Find an attachment by filename and return its ID.
 * Uses v2 GET to list, returns the first match.
 */
async function bridgeFindAttachment(pageId: string, filename: string): Promise<string | null> {
  const findResp = await requestConfluence(
    `/api/v2/pages/${pageId}/attachments?filename=${encodeURIComponent(filename)}`,
    { method: 'GET' },
  );
  if (!findResp.ok) return null;
  const data = await findResp.json();
  return data.results?.[0]?.id || null;
}

/**
 * Upload a binary blob (e.g., PNG preview) as a Confluence attachment.
 * Bridge-only — resolver has a 500KB invoke payload limit that can't handle binary.
 */
export async function uploadBlobAttachment(
  pageId: string,
  filename: string,
  blob: Blob,
): Promise<void> {
  const sizeKB = (blob.size / 1024).toFixed(1);
  console.log(`${LOG_PREFIX} uploadBlobAttachment: pageId=${pageId}, filename=${filename}, size=${sizeKB}KB, type=${blob.type}`);
  await bridgeUploadBlob(pageId, filename, blob);
  console.log(`${LOG_PREFIX} uploadBlobAttachment: success`);
}

/**
 * Download an attachment as a data URL (e.g., data:image/png;base64,...).
 * Used by the renderer to fetch preview images from attachments.
 */
export async function downloadAttachmentAsDataUrl(
  pageId: string,
  filename: string,
): Promise<string | null> {
  console.log(`${LOG_PREFIX} downloadAttachmentAsDataUrl: pageId=${pageId}, filename=${filename}`);

  // Find attachment ID via v2 listing
  const attachmentId = await bridgeFindAttachment(pageId, filename);
  if (!attachmentId) {
    console.warn(`${LOG_PREFIX} downloadAttachmentAsDataUrl: attachment not found`);
    return null;
  }

  // Download via v1 path
  const dlResp = await requestConfluence(
    `/wiki/rest/api/content/${pageId}/child/attachment/${attachmentId}/download`,
    { method: 'GET' },
  );
  if (!dlResp.ok) {
    console.error(`${LOG_PREFIX} downloadAttachmentAsDataUrl: download failed ${dlResp.status}`);
    return null;
  }

  // Convert to data URL
  const blob = await dlResp.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  console.log(`${LOG_PREFIX} downloadAttachmentAsDataUrl: got ${(dataUrl.length / 1024).toFixed(1)}KB`);
  return dataUrl;
}
