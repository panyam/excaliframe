import { requestConfluence } from '@forge/bridge';

const LOG_PREFIX = '[V2-ATTACH]';

/**
 * Diagnostic: test whether requestConfluence can reach the Confluence API at all.
 * Call from browser console via: window.__excaliframeDiag('PAGE_ID')
 */
(window as any).__excaliframeDiag = async (pageId: string) => {
  console.log(`${LOG_PREFIX} DIAG: testing requestConfluence with pageId=${pageId}`);

  try {
    const r1 = await requestConfluence(`/rest/api/content/${pageId}`, { method: 'GET' });
    console.log(`${LOG_PREFIX} DIAG: GET /content/${pageId} → ${r1.status}`);
    if (r1.ok) {
      const body = await r1.json();
      console.log(`${LOG_PREFIX} DIAG: page title="${body.title}", type="${body.type}"`);
    }
  } catch (e) {
    console.error(`${LOG_PREFIX} DIAG: GET content failed:`, e);
  }

  try {
    const r2 = await requestConfluence(`/rest/api/content/${pageId}/child/attachment`, { method: 'GET' });
    console.log(`${LOG_PREFIX} DIAG: GET attachments → ${r2.status}`);
    if (r2.ok) {
      const body = await r2.json();
      console.log(`${LOG_PREFIX} DIAG: attachments count=${body.results?.length ?? 0}`, body.results?.map((a: any) => a.title));
    }
  } catch (e) {
    console.error(`${LOG_PREFIX} DIAG: GET attachments failed:`, e);
  }

  try {
    const r3 = await requestConfluence(`/rest/api/content/${pageId}/child/attachment`, {
      method: 'PUT',
      headers: { 'X-Atlassian-Token': 'nocheck' },
      body: JSON.stringify({ comment: 'excaliframe diag test' }),
    });
    console.log(`${LOG_PREFIX} DIAG: PUT attachment (JSON body) → ${r3.status}`);
    if (!r3.ok) {
      const body = await r3.text();
      console.log(`${LOG_PREFIX} DIAG: PUT error body:`, body);
    }
  } catch (e) {
    console.error(`${LOG_PREFIX} DIAG: PUT attachment failed:`, e);
  }
};

/**
 * Upload a drawing JSON as a Confluence page attachment.
 * Uses PUT to create-or-update by filename (idempotent).
 */
export async function uploadAttachment(
  pageId: string,
  filename: string,
  jsonContent: string,
): Promise<void> {
  const sizeKB = (jsonContent.length / 1024).toFixed(1);
  console.log(`${LOG_PREFIX} uploadAttachment: pageId=${pageId}, filename=${filename}, size=${sizeKB}KB`);

  // Check if attachment already exists
  const existingId = await findAttachmentId(pageId, filename);

  const blob = new Blob([jsonContent], { type: 'application/json' });
  const form = new FormData();
  form.append('file', blob, filename);

  if (existingId) {
    console.log(`${LOG_PREFIX} updating existing attachment id=${existingId}`);
    // Update existing attachment data
    const resp = await requestConfluence(
      `/rest/api/content/${existingId}/child/attachment`,
      {
        method: 'PUT',
        headers: { 'X-Atlassian-Token': 'nocheck' },
        body: form,
      },
    );
    if (!resp.ok) {
      console.warn(`${LOG_PREFIX} PUT to attachment/${existingId} failed (${resp.status}), retrying with page-level endpoint`);
      const resp2 = await requestConfluence(
        `/rest/api/content/${pageId}/child/attachment`,
        {
          method: 'PUT',
          headers: { 'X-Atlassian-Token': 'nocheck' },
          body: form,
        },
      );
      if (!resp2.ok) {
        console.error(`${LOG_PREFIX} page-level PUT also failed: ${resp2.status} ${resp2.statusText}`);
        throw new Error(`Failed to update attachment: ${resp2.status} ${resp2.statusText}`);
      }
    }
    console.log(`${LOG_PREFIX} attachment updated successfully`);
  } else {
    console.log(`${LOG_PREFIX} creating new attachment on page ${pageId}`);
    const resp = await requestConfluence(
      `/rest/api/content/${pageId}/child/attachment`,
      {
        method: 'PUT',
        headers: { 'X-Atlassian-Token': 'nocheck' },
        body: form,
      },
    );
    if (!resp.ok) {
      console.error(`${LOG_PREFIX} upload failed: ${resp.status} ${resp.statusText}`);
      throw new Error(`Failed to upload attachment: ${resp.status} ${resp.statusText}`);
    }
    console.log(`${LOG_PREFIX} attachment created successfully`);
  }
}

/**
 * Download an attachment's content by filename.
 * Returns the raw text content, or null if not found.
 */
export async function downloadAttachment(
  pageId: string,
  filename: string,
): Promise<string | null> {
  console.log(`${LOG_PREFIX} downloadAttachment: pageId=${pageId}, filename=${filename}`);

  const attachmentId = await findAttachmentId(pageId, filename);
  if (!attachmentId) {
    console.warn(`${LOG_PREFIX} attachment not found for filename=${filename}`);
    return null;
  }

  console.log(`${LOG_PREFIX} found attachment id=${attachmentId}, downloading...`);
  const resp = await requestConfluence(
    `/rest/api/content/${attachmentId}/child/attachment/download`,
    { method: 'GET' },
  );

  if (!resp.ok) {
    console.warn(`${LOG_PREFIX} direct download failed (${resp.status}), trying metadata download link`);
    // Try the download link approach — get attachment metadata for download path
    const metaResp = await requestConfluence(
      `/rest/api/content/${attachmentId}?expand=version`,
      { method: 'GET' },
    );
    if (!metaResp.ok) {
      console.error(`${LOG_PREFIX} metadata fetch failed: ${metaResp.status}`);
      return null;
    }

    const meta = await metaResp.json();
    const downloadPath = meta._links?.download;
    if (!downloadPath) {
      console.error(`${LOG_PREFIX} no download link in metadata`);
      return null;
    }

    console.log(`${LOG_PREFIX} using download link: ${downloadPath}`);
    const dlResp = await requestConfluence(downloadPath, { method: 'GET' });
    if (!dlResp.ok) {
      console.error(`${LOG_PREFIX} download via link failed: ${dlResp.status}`);
      return null;
    }
    const text = await dlResp.text();
    console.log(`${LOG_PREFIX} downloaded ${(text.length / 1024).toFixed(1)}KB via metadata link`);
    return text;
  }

  const text = await resp.text();
  console.log(`${LOG_PREFIX} downloaded ${(text.length / 1024).toFixed(1)}KB`);
  return text;
}

/**
 * Find an attachment by filename on a page.
 * Returns the attachment content ID, or null if not found.
 */
async function findAttachmentId(
  pageId: string,
  filename: string,
): Promise<string | null> {
  const url = `/rest/api/content/${pageId}/child/attachment?filename=${encodeURIComponent(filename)}`;
  console.log(`${LOG_PREFIX} findAttachment: ${url}`);

  const resp = await requestConfluence(url, { method: 'GET' });
  if (!resp.ok) {
    console.warn(`${LOG_PREFIX} findAttachment failed: ${resp.status}`);
    return null;
  }

  const data = await resp.json();
  const results = data.results;
  if (!results || results.length === 0) {
    console.log(`${LOG_PREFIX} no attachment found for filename=${filename}`);
    return null;
  }

  console.log(`${LOG_PREFIX} found attachment: id=${results[0].id}, title=${results[0].title}`);
  return results[0].id;
}
