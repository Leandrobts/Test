<?xml version="1.0" encoding="UTF-8"?>

<xsl:stylesheet
    version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

    <xsl:import href="child-01.xsl"/>

    <xsl:template match="/">
        <html>
            <body>
                <h3>V3 XSLT chain loaded</h3>
                <p>32-level import chain.</p>
            </body>
        </html>
    </xsl:template>

</xsl:stylesheet>
