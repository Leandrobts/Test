<?xml version="1.0" encoding="UTF-8"?>

<xsl:stylesheet
    version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

    <xsl:template match="root">
        <html>
            <body>
                <h3>Grandchild stylesheet reached</h3>

                <p>
                    Final stage of the XSLT import chain.
                </p>
            </body>
        </html>
    </xsl:template>

</xsl:stylesheet>