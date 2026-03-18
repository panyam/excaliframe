const Resolver = require('@forge/resolver');
const api = require('@forge/api');

const resolver = new Resolver();

resolver.define('uploadAttachment', async ({ payload }) => {
  const { pageId, filename, content } = payload;

  const sizeKB = (content.length / 1024).toFixed(1);
  console.log(`[V2-RESOLVER] uploadAttachment: pageId=${pageId}, filename=${filename}, size=${sizeKB}KB`);

  const boundary = '----ExcaliframeBoundary' + Date.now();
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const resp = await api.asUser().requestConfluence(api.route`/wiki/rest/api/content/${pageId}/child/attachment`, {
    method: 'PUT',
    headers: {
      'X-Atlassian-Token': 'nocheck',
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    console.error(`[V2-RESOLVER] upload failed: ${resp.status}`, errBody);
    return { success: false, error: `Upload failed: ${resp.status} ${resp.statusText}` };
  }

  console.log(`[V2-RESOLVER] attachment uploaded successfully`);
  return { success: true };
});

resolver.define('downloadAttachment', async ({ payload }) => {
  const { pageId, filename } = payload;

  console.log(`[V2-RESOLVER] downloadAttachment: pageId=${pageId}, filename=${filename}`);

  const findResp = await api.asUser().requestConfluence(
    api.route`/wiki/rest/api/content/${pageId}/child/attachment?filename=${filename}`,
    { method: 'GET' },
  );

  if (!findResp.ok) {
    console.error(`[V2-RESOLVER] findAttachment failed: ${findResp.status}`);
    return { success: false, content: null };
  }

  const findData = await findResp.json();
  if (!findData.results || findData.results.length === 0) {
    console.log(`[V2-RESOLVER] attachment not found: ${filename}`);
    return { success: false, content: null };
  }

  const attachment = findData.results[0];
  const downloadPath = attachment._links?.download;
  console.log(`[V2-RESOLVER] found attachment id=${attachment.id}, downloading from ${downloadPath}`);

  if (!downloadPath) {
    console.error(`[V2-RESOLVER] no download link in attachment metadata`);
    return { success: false, content: null };
  }

  const dlResp = await api.asUser().requestConfluence(api.route`/wiki${downloadPath}`, { method: 'GET' });

  if (!dlResp.ok) {
    console.error(`[V2-RESOLVER] download failed: ${dlResp.status}`);
    return { success: false, content: null };
  }

  const text = await dlResp.text();
  console.log(`[V2-RESOLVER] downloaded ${(text.length / 1024).toFixed(1)}KB`);
  return { success: true, content: text };
});

resolver.define('diagTest', async ({ payload }) => {
  const { pageId } = payload;
  console.log(`[V2-RESOLVER] diagTest: pageId=${pageId}`);

  const results = {};

  try {
    const r1 = await api.asUser().requestConfluence(api.route`/wiki/rest/api/content/${pageId}`, { method: 'GET' });
    results.getContent = { status: r1.status, ok: r1.ok };
    if (r1.ok) {
      const body = await r1.json();
      results.getContent.title = body.title;
    }
  } catch (e) {
    results.getContent = { error: e.message };
  }

  try {
    const r2 = await api.asUser().requestConfluence(
      api.route`/wiki/rest/api/content/${pageId}/child/attachment`,
      { method: 'GET' },
    );
    results.getAttachments = { status: r2.status, ok: r2.ok };
    if (r2.ok) {
      const body = await r2.json();
      results.getAttachments.count = body.results?.length ?? 0;
    }
  } catch (e) {
    results.getAttachments = { error: e.message };
  }

  return results;
});

exports.handler = resolver.getDefinitions();
