import Script from 'next/script'

/** Contenedor público; podés sobreescribirlo con NEXT_PUBLIC_GTM_ID en `.env.local`. */
const DEFAULT_GTM_ID = 'GTM-PLDGH8V5'

function getGtmId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_GTM_ID?.trim()
  if (fromEnv === '') return null
  return fromEnv || DEFAULT_GTM_ID
}

/**
 * Google Tag Manager en todo el sitio.
 * - El script con `beforeInteractive` se inyecta en el `<head>` (recomendado por Next.js).
 * - El `<noscript>` va justo después de abrir `<body>`, como indica Google.
 */
export function GoogleTagManager() {
  const gtmId = getGtmId()
  if (!gtmId) return null

  return (
    <>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
          title="Google Tag Manager"
        />
      </noscript>
      <Script
        id="google-tag-manager"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`,
        }}
      />
    </>
  )
}
