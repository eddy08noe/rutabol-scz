import type { Metadata } from 'next';
import './globals.css';

// Datos que aparecen en la pestaña del navegador y al compartir el sitio.
export const metadata: Metadata = {
  title: 'RUTABOL-SCZ | Movilidad urbana',
  description: 'Consulta líneas, paradas, tarifas y micros del sistema de transporte RUTABOL-SCZ.',
};

// Envoltura general: fija el idioma y carga los estilos para todas las rutas.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
