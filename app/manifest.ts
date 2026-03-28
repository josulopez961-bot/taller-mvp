import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FINECAR — Taller',
    short_name: 'FINECAR',
    description: 'Sistema de gestión profesional FINECAR',
    start_url: '/admin/orders',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#f97316',
    orientation: 'portrait',
    icons: [
      {
        src: '/logo-finecar.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo-finecar.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
