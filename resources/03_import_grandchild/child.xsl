<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
<xsl:import href="grandchild.xsl"/>
<xsl:template name="child-check"><p>CHILD EXECUTADO</p><xsl:call-template name="grandchild-check"/></xsl:template>
</xsl:stylesheet>