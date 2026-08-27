<?xml version="1.0" encoding="UTF-8"?>

<xsl:stylesheet
    version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

    <xsl:import href="child.xsl"/>

    <xsl:template match="/">
        <html>
            <head>
                <title>PS4 XSLT V2</title>
            </head>

            <body>
                <h3>
                    Root stylesheet loaded.
                </h3>

                <p>
                    root.xsl → child.xsl → grandchild.xsl
                </p>
            </body>
        </html>
    </xsl:template>

</xsl:stylesheet>
