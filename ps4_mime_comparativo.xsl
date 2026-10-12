<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

  <xsl:output method="html"/>

  <xsl:template match="/">
    <html>
      <head>
        <title>PS4 XSLT</title>
      </head>
      <body style="background:green;color:white;padding:30px;font-family:Arial;">
        <h1>XSLT FUNCIONOU!</h1>
        <h2>PS4 13.52</h2>
        <p>Transformacao executada com sucesso.</p>
        <p>
          <xsl:value-of select="/teste/mensagem"/>
        </p>
      </body>
    </html>
  </xsl:template>

</xsl:stylesheet>
