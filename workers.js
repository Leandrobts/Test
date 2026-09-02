export default {
  async fetch(request) {
    // Delay de 1 segundo — equivalente ao time.sleep(1) do grandchild.py original
    await new Promise(r => setTimeout(r, 1000));

    return new Response(
      '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"/>',
      {
        headers: {
          'Content-Type': 'text/xml',
          // CORS necessário porque o parser XSL do browser faz request cross-origin
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  },
};
