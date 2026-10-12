<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:import href="xslt-import-delayed-subresource-child.xsl"/>
<xsl:output method="html" encoding="UTF-8"/>
<xsl:template match="/">
<html><head><title>PS4 XSLT - Teste de imports</title></head><body style="background:#0b2040;color:#fff;font-family:Arial;padding:24px">
<h1>Diagnostico XSLT - PS4 13.52</h1>
<p>ROOT: transformacao iniciada</p>
<xsl:call-template name="child-check"/>
<p>FIM: cadeia executada</p>
</body></html>
</xsl:template>
</xsl:stylesheet>
