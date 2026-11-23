'use client';

// Esta página presenta la información pública de RUTABOL-SCZ.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Accessibility,
  ArrowRight,
  ArrowUpRight,
  Baby,
  BookOpen,
  Bus,
  GraduationCap,
  LocateFixed,
  LockKeyhole,
  MapPin,
  Menu,
  Navigation,
  Route,
  Search,
  ShieldCheck,
  Ticket,
  UserRound,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Alert, Badge, Button, ButtonLink, Card, EmptyState } from '@/components/ui';
import TransitMapArt from '@/components/TransitMapArt';
import { api } from '@/lib/api';
import type { Linea, Micro, MicroCercano, Parada, Tarifa } from '@/lib/types';

// Nombres que se muestran en lugar de los códigos internos de cada tarifa.
const nombresCategoria: Record<string, string> = {
  GENERAL: 'General',
  MENOR_12: 'Menores de 12',
  ESCOLAR_PRIMARIA: 'Escolar primaria',
  ESCOLAR_SECUNDARIA: 'Escolar secundaria',
  UNIVERSITARIO: 'Universitario',
  ADULTO_MAYOR: 'Adulto mayor',
  DISCAPACIDAD: 'Persona con discapacidad',
  BENEMERITO: 'Benemérito',
  POLICIA_UNIFORMADO: 'Policía uniformado',
};

// Orden habitual para que las categorías se presenten de forma consistente.
const ordenCategorias: Record<string, number> = {
  GENERAL: 0,
  UNIVERSITARIO: 1,
  ESCOLAR_SECUNDARIA: 2,
  ADULTO_MAYOR: 3,
  DISCAPACIDAD: 4,
  ESCOLAR_PRIMARIA: 5,
  MENOR_12: 6,
};

// Icono que ayuda a reconocer visualmente cada tipo de tarifa.
const iconosCategoria: Record<string, LucideIcon> = {
  GENERAL: Bus,
  UNIVERSITARIO: GraduationCap,
  ESCOLAR_SECUNDARIA: GraduationCap,
  ADULTO_MAYOR: UserRound,
  DISCAPACIDAD: Accessibility,
  ESCOLAR_PRIMARIA: BookOpen,
  MENOR_12: Baby,
};

// Presenta el importe usando el formato de moneda boliviana.
function dinero(importe: number | string, moneda = 'BOB') {
  return new Intl.NumberFormat('es-BO', { style: 'currency', currency: moneda }).format(Number(importe));
}

// Si el precio cambia por línea, la tarjeta deja elegir cuál consultar.
function TarjetaTarifa({ categoria, registros, destacada = false }: { categoria: string; registros: Tarifa[]; destacada?: boolean }) {
  const [lineaSeleccionada, setLineaSeleccionada] = useState<number | null>(null);
  const porLinea = [...new Map(registros.map((tarifa) => [tarifa.lineaId, tarifa])).values()];
  const cambiaPorLinea = new Set(porLinea.map((tarifa) => Number(tarifa.importe))).size > 1;
  const tarifa = porLinea.find((item) => item.lineaId === lineaSeleccionada) ?? porLinea[0];
  const IconoCategoria = iconosCategoria[categoria] ?? Bus;

  return (
    <Card className={`fare-card${destacada ? ' fare-card--featured' : ''}`}>
      <div className="fare-card__top">
        <span className="fare-icon"><IconoCategoria aria-hidden="true" /></span>
        {destacada && <Badge className="fare-badge">Tarifa base</Badge>}
      </div>
      <h3>{nombresCategoria[categoria] ?? categoria}</h3>
      <strong className="fare-amount">{dinero(tarifa.importe, tarifa.moneda)}</strong>
      {cambiaPorLinea && (
        <label className="fare-select">
          <span>Selecciona una línea</span>
          <select
            aria-label={`Selecciona la línea para la tarifa ${nombresCategoria[categoria] ?? categoria}`}
            value={tarifa.lineaId}
            onChange={(event) => setLineaSeleccionada(Number(event.target.value))}
          >
            {porLinea.map((item) => <option key={item.lineaId} value={item.lineaId}>{item.linea}</option>)}
          </select>
        </label>
      )}
    </Card>
  );
}

// Textos e iconos que explican de manera breve cómo usar el servicio.
const pasos = [
  { icon: Search, title: 'Busca tu línea', description: 'Explora recorridos y encuentra una ruta que se acerque a tu destino.' },
  { icon: Navigation, title: 'Encuentra micros cerca', description: 'Consulta unidades con ubicación reciente alrededor de ti.' },
  { icon: WalletCards, title: 'Viaja y paga', description: 'Gestiona tus pasajes y consulta la información de tus pagos.' },
];

export default function Home() {
  // Información pública que se muestra en portada.
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [micros, setMicros] = useState<Micro[]>([]);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [microsCercanos, setMicrosCercanos] = useState<MicroCercano[] | null>(null);
  const [buscandoCercanos, setBuscandoCercanos] = useState(false);
  const [errorCercanos, setErrorCercanos] = useState('');
  // Controla el menú desplegable que se usa en pantallas pequeñas.
  const [menuAbierto, setMenuAbierto] = useState(false);

  // La portada carga los recorridos y precios publicados para mostrarlos aquí.
  const cargarCatalogo = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [lineasData, microsData, paradasData, tarifasData] = await Promise.all([
        api.lineas(),
        api.micros(),
        api.paradas(),
        api.tarifas(),
      ]);
      setLineas(lineasData);
      setMicros(microsData);
      setParadas(paradasData);
      setTarifas(tarifasData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la información del transporte.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargarCatalogo(); }, [cargarCatalogo]);

  // Los importes en cero no se muestran como tarifas para el público.
  const categoriasTarifa = useMemo(() => Object.entries(
    tarifas
      .filter((tarifa) => Number(tarifa.importe) !== 0)
      .reduce<Record<string, Tarifa[]>>((grupos, tarifa) => {
        (grupos[tarifa.categoria] ??= []).push(tarifa);
        return grupos;
      }, {}),
  ).sort(([categoriaA], [categoriaB]) => (ordenCategorias[categoriaA] ?? Number.MAX_SAFE_INTEGER) - (ordenCategorias[categoriaB] ?? Number.MAX_SAFE_INTEGER)), [tarifas]);

  // Solo se consulta la ubicación después de que la persona lo solicita.
  function buscarMicrosCercanos() {
    setErrorCercanos('');
    setMicrosCercanos(null);
    if (!navigator.geolocation) {
      setErrorCercanos('Este navegador no permite consultar tu ubicación.');
      return;
    }

    setBuscandoCercanos(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          setMicrosCercanos(await api.microsCercanos(coords.latitude, coords.longitude));
        } catch (cause) {
          setErrorCercanos(cause instanceof Error ? cause.message : 'No se pudieron consultar micros cercanos.');
        } finally {
          setBuscandoCercanos(false);
        }
      },
      (cause) => {
        const mensajes: Record<number, string> = {
          1: 'Permite el acceso a tu ubicación para buscar micros cercanos.',
          2: 'No fue posible determinar tu ubicación. Inténtalo nuevamente.',
          3: 'La consulta de ubicación tardó demasiado. Inténtalo nuevamente.',
        };
        setErrorCercanos(mensajes[cause.code] ?? 'No se pudo acceder a tu ubicación.');
        setBuscandoCercanos(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  const unidadesActivas = micros.filter((micro) => micro.estado === 'ACTIVO').length;
  // Se separa la tarifa general para destacarla y mostrar el resto a su lado.
  const categoriaGeneral = categoriasTarifa.find(([categoria]) => categoria === 'GENERAL');
  const otrasCategorias = categoriasTarifa.filter(([categoria]) => categoria !== 'GENERAL');
  const IconoAcceso = menuAbierto ? X : Menu;

  return (
    <main>
      {/* El menú lleva directamente a cada sección de la portada. */}
      <header className="site-header">
        <div className="page-shell header-content">
          <Link className="brand" href="/" aria-label="RUTABOL-SCZ, inicio">
            <span className="brand-mark"><Route aria-hidden="true" /></span>
            <span><strong>RUTABOL-SCZ</strong><small>Movilidad que conecta</small></span>
          </Link>
          <nav className={`main-nav${menuAbierto ? ' main-nav--open' : ''}`} aria-label="Navegación principal">
            <a href="#como-funciona" onClick={() => setMenuAbierto(false)}>Cómo funciona</a>
            <a href="#lineas" onClick={() => setMenuAbierto(false)}>Líneas</a>
            <a href="#tarifas" onClick={() => setMenuAbierto(false)}>Tarifas</a>
            <a href="#micros-cercanos" onClick={() => setMenuAbierto(false)}>Micros cercanos</a>
          </nav>
          <div className="header-actions">
            <ButtonLink href="#accesos" variant="light" className="header-login">Ingresar <ArrowUpRight aria-hidden="true" /></ButtonLink>
            <Button className="menu-toggle" variant="ghost" type="button" aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuAbierto} onClick={() => setMenuAbierto((actual) => !actual)}>
              <IconoAcceso aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      {/* Presentación de RUTABOL-SCZ y accesos separados por tipo de cuenta. */}
      <section className="hero">
        <div className="page-shell hero-content">
          <div className="hero-copy reveal">
            <Badge className="hero-kicker"><span className="status-dot" /> MOVILIDAD URBANA · SANTA CRUZ</Badge>
            <h1>Muévete por Santa Cruz con <span>claridad y seguridad.</span></h1>
            <p>Encuentra tu línea, ubica micros cerca y planifica cada trayecto con información conectada a RUTABOL-SCZ.</p>
            <div className="hero-actions">
              <ButtonLink href="/acceso" className="button--hero-primary">Iniciar sesión <ArrowRight aria-hidden="true" /></ButtonLink>
              <ButtonLink href="/acceso/cliente/registro" variant="light" className="button--hero-light">Crear cuenta de cliente</ButtonLink>
            </div>
            <div className="hero-trust"><ShieldCheck aria-hidden="true" /><span>Un solo acceso; el panel depende de tu rol</span></div>
          </div>
          <div className="hero-visual reveal">
            <TransitMapArt />
            <div className="hero-orbit hero-orbit--one" />
            <div className="hero-orbit hero-orbit--two" />
          </div>
        </div>
        <div className="page-shell hero-stats">
          <div className="hero-stat"><span className="hero-stat__icon"><Route aria-hidden="true" /></span><span className="hero-stat__value">{cargando ? '—' : lineas.length}</span><span className="hero-stat__label">Líneas activas</span></div>
          <div className="hero-stat"><span className="hero-stat__icon"><Bus aria-hidden="true" /></span><span className="hero-stat__value">{cargando ? '—' : unidadesActivas}</span><span className="hero-stat__label">Micros activos</span></div>
          <div className="hero-stat"><span className="hero-stat__icon"><Ticket aria-hidden="true" /></span><span className="hero-stat__value">{cargando ? '—' : categoriasTarifa.length}</span><span className="hero-stat__label">Categorías de tarifa</span></div>
          <p>Datos consultados desde la API</p>
        </div>
      </section>

      <div className="page-shell page-content">
        {error && <Alert>{error} <button className="alert-action" type="button" onClick={() => void cargarCatalogo()}>Reintentar</button></Alert>}

        {/* Pasos cortos para explicar qué puede hacer una persona en el sitio. */}
        <section className="how-section section-block reveal" id="como-funciona">
          <div className="section-heading">
            <div><Badge className="section-kicker">SIMPLE DESDE EL PRIMER PASO</Badge><h2>Tu próximo viaje,<br /><span>en tres pasos.</span></h2></div>
            <p>Lo esencial para moverte por la ciudad, reunido en una experiencia clara.</p>
          </div>
          <div className="steps-row">
            {pasos.map(({ icon: Icon, title, description }, index) => (
              <div className="step-item" key={title}>
                <span className="step-number">0{index + 1}</span>
                <span className="step-icon"><Icon aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Líneas que llegan desde el sistema, con sus colores y datos reales. */}
        <section className="lines-section section-block reveal" id="lineas">
          <div className="section-heading">
            <div><Badge className="section-kicker">EXPLORA LA CIUDAD</Badge><h2>Líneas que te <span>acercan.</span></h2><span className="section-accent" /><p>Elige una línea y revisa las paradas disponibles para organizar tu recorrido.</p></div>
            <Badge className="section-count">{cargando ? 'Cargando…' : `${lineas.length} ${lineas.length === 1 ? 'línea' : 'líneas'}`}</Badge>
          </div>
          {cargando ? <div className="loading-state" role="status">Cargando líneas de transporte…</div> : lineas.length ? (
            <div className="line-grid">
              {lineas.map((linea) => (
                <Card className="line-card" key={linea.id} style={{ '--line-color': linea.color } as React.CSSProperties}>
                  <div className="line-card__head">
                    <Badge className="line-badge">L{linea.id}</Badge>
                    <Route aria-hidden="true" />
                  </div>
                  <div><p className="line-zone">{linea.zona}</p><h3>{linea.nombre}</h3><p className="line-description">{linea.descripcion}</p></div>
                  <a className="line-card__link" href="#paradas">Ver paradas <ArrowRight aria-hidden="true" /></a>
                </Card>
              ))}
            </div>
          ) : !error ? <EmptyState icon={Route} title="Aún no hay líneas disponibles" description="Las líneas aparecerán aquí cuando estén publicadas." /> : null}
        </section>

        {/* Precios agrupados por categoría para facilitar su comparación. */}
        <section className="fare-section section-block reveal" id="tarifas">
          <div className="section-heading">
            <div><Badge className="section-kicker">TRANSPARENCIA EN TU VIAJE</Badge><h2>Tarifas claras,<br /><span>viajes tranquilos.</span></h2><p>Importes vigentes agrupados por categoría. Si varían por línea, puedes consultar cada opción.</p></div>
            <Badge className="section-count">{cargando ? 'Cargando…' : `${categoriasTarifa.length} categorías`}</Badge>
          </div>
          {cargando ? <div className="loading-state" role="status">Cargando tarifas vigentes…</div> : categoriasTarifa.length ? (
            <div className="fare-layout">
              {categoriaGeneral && <TarjetaTarifa categoria={categoriaGeneral[0]} registros={categoriaGeneral[1]} destacada />}
              <div className="fare-grid">
                {otrasCategorias.map(([categoria, registros]) => <TarjetaTarifa key={categoria} categoria={categoria} registros={registros} />)}
              </div>
            </div>
          ) : !error ? <EmptyState icon={Ticket} title="No hay tarifas vigentes" description="Las tarifas activas se mostrarán aquí." /> : null}
        </section>

        {/* Búsqueda de micros cercanos, solo con permiso de ubicación. */}
        <section className="nearby-section section-block reveal" id="micros-cercanos">
          <div className="nearby-copy">
            <Badge className="section-kicker">TU VIAJE, MÁS CERCA</Badge>
            <h2>Encuentra micros<br /><span>cerca de ti.</span></h2>
            <p>Comparte tu ubicación para consultar micros activos con posición reciente en un radio de hasta 5 km.</p>
            <Button type="button" className="nearby-button" onClick={buscarMicrosCercanos} disabled={buscandoCercanos}>
              <LocateFixed aria-hidden="true" /> {buscandoCercanos ? 'Buscando micros…' : 'Buscar cerca de mí'} <ArrowRight aria-hidden="true" />
            </Button>
            {errorCercanos && <Alert>{errorCercanos}</Alert>}
            {microsCercanos && (microsCercanos.length ? (
              <ul className="nearby-list">
                {microsCercanos.map((micro) => <li key={micro.id}><span className="nearby-list__icon"><Bus aria-hidden="true" /></span><span className="nearby-list__copy"><strong>Interno {micro.interno}</strong><small>{micro.linea}</small></span><Badge className="distance">{micro.distanciaKm.toFixed(1)} km</Badge></li>)}
              </ul>
            ) : <p className="nearby-empty" role="status">No encontramos micros activos con ubicación reciente cerca de ti.</p>)}
          </div>
          <div className="nearby-visual"><TransitMapArt variant="nearby" /><div className="nearby-map-caption"><span className="status-dot" /> Visualización ilustrativa · sin ubicaciones simuladas</div></div>
        </section>

        {/* Paradas registradas para las líneas disponibles. */}
        <section className="stops-section section-block reveal" id="paradas">
          <div className="section-heading">
            <div><Badge className="section-kicker">A LO LARGO DE TU RUTA</Badge><h2>Paradas de transporte</h2><p>Encuentra los puntos disponibles asociados a las líneas.</p></div>
            <Badge className="section-count">{cargando ? 'Cargando…' : `${paradas.length} paradas`}</Badge>
          </div>
          {cargando ? <div className="loading-state" role="status">Cargando paradas…</div> : paradas.length ? (
            <div className="stops-list">
              {paradas.map((parada) => {
                const linea = lineas.find((item) => item.id === parada.lineaId);
                return (
                  <Card className="stop-row" key={`${parada.lineaId ?? 'sin-linea'}-${parada.id}`}>
                    <span className="stop-icon"><MapPin aria-hidden="true" /></span>
                    <span className="stop-copy"><strong>{parada.nombre}</strong><small>{linea?.nombre ?? 'Línea no especificada'}</small></span>
                    <span className="stop-order">{parada.orden ? `Parada ${parada.orden}` : 'Parada'}</span>
                  </Card>
                );
              })}
            </div>
          ) : !error ? <EmptyState icon={MapPin} title="Aún no hay paradas publicadas" description="Cuando se registren paradas, podrás encontrarlas aquí." /> : null}
        </section>

        {/* El acceso es único; el panel se elige según el rol de la cuenta. */}
        <section className="access-section section-block reveal" id="accesos">
          <div className="access-section__intro">
            <Badge className="section-kicker">BIENVENIDO A RUTABOL-SCZ</Badge>
            <h2>Tu movilidad,<br /><span>en tus manos.</span></h2>
            <p>Inicia sesión una sola vez y te llevaremos al panel de tu perfil.</p>
          </div>
          <div className="access-choices">
            <Card className="access-choice access-choice--client">
              <span className="access-choice__icon"><UserRound aria-hidden="true" /></span>
              <div><h3>Acceso RUTABOL-SCZ</h3><p>Clientes y personal autorizado ingresan desde el mismo lugar. El rol de tu cuenta abre su panel.</p></div>
              <ButtonLink href="/acceso">Iniciar sesión <ArrowRight aria-hidden="true" /></ButtonLink>
              <ButtonLink href="/acceso/cliente/registro" variant="secondary">Crear cuenta de cliente <ArrowRight aria-hidden="true" /></ButtonLink>
            </Card>
          </div>
        </section>
      </div>

      {/* Aviso final: el proyecto es una demostración y los datos son ficticios. */}
      <footer className="site-footer">
        <div className="page-shell footer-grid">
          <div className="footer-brand-block"><Link className="brand brand--footer" href="/"><span className="brand-mark"><Route aria-hidden="true" /></span><span><strong>RUTABOL-SCZ</strong><small>Movilidad que conecta</small></span></Link><p>Una experiencia más clara para moverte por Santa Cruz.</p></div>
          <div className="footer-links"><strong>Explorar</strong><a href="#lineas">Líneas</a><a href="#tarifas">Tarifas</a><a href="#paradas">Paradas</a></div>
          <div className="footer-links"><strong>Accesos</strong><Link href="/acceso">Iniciar sesión</Link><Link href="/acceso/cliente/registro">Crear cuenta de cliente</Link></div>
          <div className="footer-disclaimer"><span><ShieldCheck aria-hidden="true" /> Plataforma de demostración</span><p>Los datos y recorridos son ficticios; no representan información oficial de transporte.</p><span className="footer-copyright">RUTABOL-SCZ · Movilidad urbana</span></div>
        </div>
      </footer>
    </main>
  );
}
