<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:import href="xslt-import-delayed-subresource-child.xsl"/>
  <xsl:output method="html" encoding="UTF-8"/>
  <xsl:template match="/">
    <html><head><title>PS4 XSLT - Verificacao</title></head><body style="background:#102a52;color:white;font-family:Arial;padding:24px">
      <h1>IMPORTS XSLT FUNCIONANDO</h1>
      <p>ROOT: carregado</p>
      <xsl:call-template name="child-status"/>
      <xsl:call-template name="grandchild-status"/>
      <p>Este teste confirma a cadeia de imports, nao reproduz o teste de UAF do commit.</p>
    </body></html>
  </xsl:template>
</xsl:stylesheet>
