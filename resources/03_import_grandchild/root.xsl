<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
<xsl:import href="child.xsl"/>
<xsl:output method="html" encoding="UTF-8"/>
<xsl:template match="/">
<html><head><title>Diagnostico XSLT 03_import_grandchild</title></head><body style="background:#082446;color:white;font-family:Arial;padding:24px">
<h1>ETAPA 4 - 03_import_grandchild</h1><p>ROOT EXECUTADO</p>
<xsl:call-template name="child-check"/>
<p>FIM DA TRANSFORMACAO</p>
</body></html>
</xsl:template>
</xsl:stylesheet>