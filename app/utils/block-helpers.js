const NODE_API = 'http://127.0.0.1:15037';

export async function getBlockByHeight(height) {
  const resp = await fetch(NODE_API, {
    method: 'POST',
    body: JSON.stringify({
      method: 'getblockbyheight',
      params: [ height, 1, 0 ],
    }),
  });

  return await resp.json();
}
