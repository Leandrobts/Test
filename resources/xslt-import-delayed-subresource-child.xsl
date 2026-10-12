<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:import href="xslt-import-delayed-subresource-grandchild.xsl"/>
<xsl:template name="child-check">
<p>CHILD: template executado</p>
<xsl:call-template name="grandchild-check"/>
</xsl:template>
</xsl:stylesheet>
