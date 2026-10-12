
<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet
  version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

  <xsl:output method="html" encoding="UTF-8"/>

  <xsl:template match="/">
    <html>
      <head>
        <title>PS4 - Teste MIME XSLT</title>
      </head>
      <body style="background:#123456;color:white;font-family:Arial;padding:25px;">
        <h1>XSLT EXECUTADO COM SUCESSO</h1>
        <h2>PS4 13.52</h2>
        <p>O navegador aplicou a folha XSLT.</p>
        <p>Mensagem original:</p>
        <strong>
          <xsl:value-of select="/teste/mensagem"/>
        </strong>
      </body>
    </html>
  </xsl:template>

</xsl:stylesheet>
