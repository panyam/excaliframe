import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

resolver.define('uploadAttachment', async ({ payload }) => {
  const { pageId, filename, content } = payload as {
    pageId: string;
    filename: string;
    content: string;
  };

  console.log(`[V2-RESOLVER] uploadAttachment: pageId=${pageId}, filename=${filename}, size=${(content.length / 1024).toFixed(1)}KB`);

  // Check if attachment already exists
  const existingId = await findAttachmentId(pageId, filename);

  if (existingId) {
    console.log(`[V2-RESOLVER] updating existing attachment id=${existingId}`);
    // Update existing: POST to the attachment's own data endpoint
    const resp = await api.asUser().requestConfluence(
      route`/rest/api/content/${existingId}/child/attachment`,
      {
        method: 'PUT',
        headers: {
          'X-Atlassian-Token': 'nocheck',
          'Content-Type': 'application/json',
        },
        body: content,
      },
    );

    if (!resp.ok) {
      // Try page-level PUT with multipart approach
      console.warn(`[V2-RESOLVER] direct update failed (${resp.status}), trying page-level PUT`);
      const resp2 = await api.asUser().requestConfluence(
        route`/rest/api/content/${pageId}/child/attachment`,
        {
          method: 'PUT',
          headers: {
            'X-Atlassian-Token': 'nocheck',
            'Content-Type': 'multipart/form-data',
          },
          body: createMultipartBody(filename, content),
        },
      );
      if (!resp2.ok) {
        const body = await resp2.text();
        console.error(`[V2-RESOLVER] page-level PUT failed: ${resp2.status}`, body);
        return { success: false, error: `Upload failed: ${resp2.status} ${resp2.statusText}` };
      }
    }

    console.log(`[V2-RESOLVER] attachment updated successfully`);
    return { success: true };
  }

  // Create new attachment via PUT (create-or-update)
  console.log(`[V2-RESOLVER] creating new attachment on page ${pageId}`);
  const resp = await api.asUser().requestConfluence(
    route`/rest/api/content/${pageId}/child/attachment`,
    {
      method: 'PUT',
      headers: {
        'X-Atlassian-Token': 'nocheck',
        'Content-Type': 'multipart/form-data',
      },
      body: createMultipartBody(filename, content),
    },
  );

  if (!resp.ok) {
    const body = await resp.text();
    console.error(`[V2-RESOLVER] upload failed: ${resp.status}`, body);
    return { success: false, error: `Upload failed: ${resp.status} ${resp.statusText}` };
  }

  console.log(`[V2-RESOLVER] attachment created successfully`);
  return { success: true };
});

resolver.define('downloadAttachment', async ({ payload }) => {
  const { pageId, filename } = payload as { pageId: string; filename: string };

  console.log(`[V2-RESOLVER] downloadAttachment: pageId=${pageId}, filename=${filename}`);

  const attachmentId = await findAttachmentId(pageId, filename);
  if (!attachmentId) {
    console.warn(`[V2-RESOLVER] attachment not found for filename=${filename}`);
    return { success: false, content: null };
  }

  // Get download link from attachment metadata
  console.log(`[V2-RESOLVER] found attachment id=${attachmentId}, fetching metadata...`);
  const metaResp = await api.asUser().requestConfluence(
    route`/rest/api/content/${attachmentId}?expand=version`,
    { method: 'GET' },
  );

  if (!metaResp.ok) {
    console.error(`[V2-RESOLVER] metadata fetch failed: ${metaResp.status}`);
    return { success: false, content: null };
  }

  const meta = await metaResp.json();
  const downloadPath = meta._links?.download;
  if (!downloadPath) {
    console.error(`[V2-RESOLVER] no download link in metadata`);
    return { success: false, content: null };
  }

  console.log(`[V2-RESOLVER] downloading from: ${downloadPath}`);
  const dlResp = await api.asUser().requestConfluence(
    route`${downloadPath}`,
    { method: 'GET' },
  );

  if (!dlResp.ok) {
    console.error(`[V2-RESOLVER] download failed: ${dlResp.status}`);
    return { success: false, content: null };
  }

  const content = await dlResp.text();
  console.log(`[V2-RESOLVER] downloaded ${(content.length / 1024).toFixed(1)}KB`);
  return { success: true, content };
});

async function findAttachmentId(pageId: string, filename: string): Promise<string | null> {
  console.log(`[V2-RESOLVER] findAttachment: pageId=${pageId}, filename=${filename}`);

  const resp = await api.asUser().requestConfluence(
    route`/rest/api/content/${pageId}/child/attachment?filename=${filename}`,
    { method: 'GET' },
  );

  if (!resp.ok) {
    console.warn(`[V2-RESOLVER] findAttachment failed: ${resp.status}`);
    return null;
  }

  const data = await resp.json();
  const results = data.results;
  if (!results || results.length === 0) {
    console.log(`[V2-RESOLVER] no attachment found for filename=${filename}`);
    return null;
  }

  console.log(`[V2-RESOLVER] found attachment: id=${results[0].id}, title=${results[0].title}`);
  return results[0].id;
}

/**
 * Build a multipart/form-data body string for attachment upload.
 * Node's Forge runtime doesn't have FormData, so we construct it manually.
 */
function createMultipartBody(filename: string, content: string): string {
  const boundary = '----ExcaliframeBoundary' + Date.now();
  return [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');
}

export const handler = resolver.getDefinitions();
