// Dibujo decorativo del recorrido; no muestra ubicaciones reales.
export default function TransitMapArt({ variant = 'hero' }: { variant?: 'hero' | 'nearby' }) {
  return (
    <svg className={`transit-art transit-art--${variant}`} viewBox="0 0 640 440" role="img" aria-label="Ilustración de una ruta urbana con un micro y puntos de parada">
      {/* Los trazos y el micro son una ilustración, no datos de transporte en tiempo real. */}
      <defs>
        {/* Colores y sombra que se aplican al fondo y al dibujo del micro. */}
        <linearGradient id={`map-bg-${variant}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--color-map-start)" />
          <stop offset="1" stopColor="var(--color-map-end)" />
        </linearGradient>
        <linearGradient id={`bus-bg-${variant}`} x1="0" x2="1">
          <stop offset="0" stopColor="var(--color-primary)" />
          <stop offset="1" stopColor="var(--color-map-highlight)" />
        </linearGradient>
        <filter id={`map-shadow-${variant}`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="var(--color-night)" floodOpacity=".18" />
        </filter>
      </defs>
      <rect x="18" y="16" width="604" height="408" rx="38" fill={`url(#map-bg-${variant})`} />
      {/* Cuadrícula y calles de fondo para dar contexto al recorrido ilustrado. */}
      <g className="art-grid" opacity=".5">
        <path d="M75 48v344M155 48v344M235 48v344M315 48v344M395 48v344M475 48v344M555 48v344M42 110h556M42 190h556M42 270h556M42 350h556" />
      </g>
      <g className="art-streets">
        <path d="m75 120 94 0 40 56 93 0 44-68 94 0 52 72" />
        <path d="m98 320 76-64 71 0 46-60 84 0 68 64 66 0" />
        <path d="m169 75 0 45m177-72v108m108 9 0 95m-284 20v84" />
      </g>
      {/* Línea, paradas y etiqueta que representan un trayecto genérico. */}
      <path className="art-route-shadow" d="M82 321h91l71-65 76-79h95l62 63h76" />
      <path className="art-route" d="M82 321h91l71-65 76-79h95l62 63h76" />
      <g className="art-waypoints">
        <circle cx="82" cy="321" r="10" />
        <circle cx="173" cy="321" r="10" />
        <circle cx="244" cy="256" r="10" />
        <circle cx="320" cy="177" r="10" />
        <circle cx="415" cy="177" r="10" />
        <circle cx="477" cy="240" r="10" />
        <circle cx="553" cy="240" r="10" />
      </g>
      <g className="art-map-label">
        <rect x="62" y="350" width="99" height="30" rx="15" />
        <text x="111" y="370" textAnchor="middle">Tu recorrido</text>
      </g>
      {/* Vehículo decorativo y distintivo visual de ruta conectada. */}
      <g className="art-bus" filter={`url(#map-shadow-${variant})`} transform="translate(294 108)">
        <rect x="0" y="0" width="116" height="68" rx="18" fill={`url(#bus-bg-${variant})`} />
        <path d="M18 15h49v24H18zM76 15h23v24H76z" fill="var(--color-bus-window)" />
        <path d="M16 48h84" stroke="var(--color-white)" strokeOpacity=".7" strokeWidth="3" strokeLinecap="round" />
        <circle cx="25" cy="69" r="10" fill="var(--color-night)" />
        <circle cx="90" cy="69" r="10" fill="var(--color-night)" />
        <circle cx="25" cy="69" r="4" fill="var(--color-white)" />
        <circle cx="90" cy="69" r="4" fill="var(--color-white)" />
      </g>
      <g className="art-live-pill">
        <rect x="420" y="67" width="143" height="39" rx="19.5" />
        <circle cx="442" cy="86.5" r="5" />
        <text x="456" y="91">Ruta conectada</text>
      </g>
    </svg>
  );
}
