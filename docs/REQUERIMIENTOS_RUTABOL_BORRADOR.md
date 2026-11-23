# Sistema RUTABOL-SCZ — Requisitos depurados

**Estado:** borrador actualizado con aclaraciones del usuario; reglas operativas y tarifas sujetas a confirmación con municipio/sindicatos.

Este borrador consolida los antecedentes y la Actividad 01. No presupone que ya estén decididas las reglas marcadas al final.

## Requerimientos funcionales

| Código | Requerimiento |
|---|---|
| RF-01 | El sistema deberá mantener tarifas por categoría y periodo de vigencia, sin permitir al chofer modificarlas. La tarifa base cargada será: general Bs 3,50; universitario/secundaria Bs 1,00; adulto mayor/discapacidad Bs 1,00; menor/primaria Bs 0,50; benemérito y policía uniformado exentos. Los valores se pueden actualizar con fecha de vigencia. |
| RF-02 | El sistema deberá registrar por unidad su capacidad total autorizada y, si consta en la documentación, cuántas plazas son sentadas y cuántas de pie. El sistema sugerirá el número de plazas sentadas y solo permitirá el aforo de pie si está autorizado para esa unidad. Impedirá nuevos abordajes al alcanzar el límite operativo configurado, que nunca superará la capacidad total autorizada. |
| RF-03 | El sistema deberá identificar cada línea por su número (por ejemplo, 55 o 56) y cada micro por placa e interno dentro de esa línea. La placa será única y el interno deberá ser único en su línea. |
| RF-04 | El sistema deberá mostrar micros activos ubicados dentro de un radio de búsqueda de 5 km respecto del pasajero. Este radio sirve para buscar unidades cercanas; no limita la longitud ni el recorrido de una línea. |
| RF-05 | El sistema deberá registrar el abordaje y descenso de pasajeros en cada viaje para calcular la ocupación actual y liberar cupos cuando un pasajero descienda. El abordaje puede registrar pago en efectivo junto a la validación del pasaje; queda por integrar el lector QR en la interfaz. |
| RF-06 | El sistema deberá registrar trasbordos regulares al punto de retorno/descanso autorizado por la operación de la línea, identificando micro y viaje de origen, micro y viaje de destino, pasajeros transferidos y el operador responsable. La regla de si el reemplazo puede ser de otra línea queda pendiente de los acuerdos del sindicato. |
| RF-07 | El sistema deberá permitir registrar trasbordos de emergencia por falla mecánica u otra emergencia del conductor, indicando el motivo y los viajes de origen y destino. |
| RF-08 | El sistema deberá permitir registrar estudiantes escolares y sus datos de validación definidos por el proyecto, incluyendo código RUDE y evidencia de identidad, y mantener el estado de revisión de la solicitud. |
| RF-09 | El sistema deberá permitir registrar estudiantes universitarios mediante código de estudiante, correo institucional terminado en `@upds.edu.bo` y evidencia de identidad, y mantener el estado de revisión de la solicitud. |
| RF-10 | Un administrador deberá poder revisar las solicitudes de validación estudiantil y aprobarlas o rechazarlas, registrando quién tomó la decisión, cuándo y, si corresponde, el motivo del rechazo. |
| RF-11 | El sistema registra pagos en efectivo y simula pagos con tarjeta solo para el prototipo. No se conectará a ningún banco ni almacenará datos de tarjeta. |
| RF-12 | El sistema deberá asociar pagos y devoluciones al pasaje. Si el pasajero acepta un micro de reemplazo tras una emergencia, continuará sin un segundo cobro ni devolución. Si rechaza continuar por una avería y toma otra línea por su cuenta, se cancela el pasaje original y se registra la devolución completa del monto cobrado; no se calcula por tramos. |
| RF-13 | El sistema deberá gestionar cuentas y permisos para los roles que se definan, como pasajero, chofer y administrador. Las funciones disponibles deberán depender del rol. |
| RF-14 | El sistema deberá permitir registrar qué chofer y micro operaron cada viaje, con hora real de inicio y fin. La programación anticipada de turnos y descansos depende de información y reglas que todavía deben proporcionar los sindicatos; no se presupone un calendario único. |

## Requerimientos no funcionales

| Código | Requerimiento |
|---|---|
| RNF-01 — Seguridad | El sistema deberá autenticar a los usuarios y autorizar cada operación según su rol. Las contraseñas se almacenarán mediante un algoritmo de hash adecuado. |
| RNF-02 — Privacidad | El sistema deberá limitar el acceso a datos personales, códigos estudiantiles, fotografías y documentos a los usuarios autorizados, y definir su tiempo de conservación y eliminación. |
| RNF-03 — Rendimiento | Las consultas de disponibilidad y geolocalización deberán responder en un máximo objetivo de 3 segundos bajo una carga de trabajo que deberá especificarse y medirse. |
| RNF-04 — Disponibilidad | El objetivo de disponibilidad será de al menos 99 % mensual durante los horarios de operación, excluyendo ventanas de mantenimiento previamente definidas. |
| RNF-05 — Usabilidad | La interfaz deberá permitir que pasajeros, choferes y administradores completen sus tareas principales sin conocimientos técnicos avanzados. |
| RNF-06 — Compatibilidad | La aplicación deberá funcionar en dispositivos Android mediante navegadores web modernos. |
| RNF-07 — Escalabilidad | La arquitectura deberá permitir agregar líneas, micros y usuarios sin rediseñar completamente el sistema. |
| RNF-08 — Integridad | Los pagos, abordajes, ocupación y trasbordos deberán mantener relaciones consistentes y evitar registros duplicados. |
| RNF-09 — Precisión geográfica | El sistema deberá usar una fuente de ubicación definida para calcular la distancia entre el pasajero y los micros disponibles dentro del radio configurado. |
| RNF-10 — Mantenibilidad | La arquitectura deberá facilitar la actualización, corrección de errores y ampliación de funciones. |
| RNF-11 — Confiabilidad | El sistema deberá realizar copias de seguridad y conservar las operaciones confirmadas ante interrupciones, según una política de recuperación que deberá definirse. |
| RNF-12 — Interoperabilidad | El sistema deberá permitir integración con una pasarela de pago y servicios de mapas o GPS. La validación estudiantil será manual por un administrador, salvo que posteriormente se confirme un servicio externo disponible. |

## Reglas de modelado recomendadas

- Un abordaje/pasaje debe enlazar pasajero o ticket, viaje y hora de subida; la hora de bajada permanece vacía hasta el descenso.
- La ocupación se obtiene de abordajes activos. Si se guarda un contador para acelerar consultas, debe mantenerse sincronizado con esos registros.
- Un trasbordo enlaza el pasaje del viaje de origen con el viaje de destino y registra motivo, hora y pasajeros transferidos. Los motivos regulares y de emergencia comparten la entidad trasbordo.
- El pago conserva importe, moneda, estado y referencia del proveedor; los datos completos de la tarjeta permanecen en la pasarela.
- Las coordenadas actuales pueden consultarse desde una ubicación reciente del micro; el historial GPS, si se necesita, debe tener una política de retención separada.
- Las fotos/documentos de estudiantes deberían almacenarse con acceso restringido; la base de datos puede guardar la referencia y el estado de revisión.

## Flujo de trasbordos y reembolsos según las aclaraciones actuales

### Trasbordo normal

1. En líneas que realizan vueltas por anillos, al llegar al punto de retorno/descanso, el operador registra el viaje de origen y el micro de reemplazo conforme a la regla del sindicato.
2. El pasajero conserva el mismo pasaje/ticket para continuar por la línea.
3. El sistema registra el trasbordo y actualiza el viaje/micro activo del pasaje; no crea otro pago ni un reembolso.
4. Si el operador necesita distribuir ingresos entre los micros o choferes, se registra como liquidación interna separada del pago del pasajero.

### Trasbordo de emergencia

1. El chofer u operador registra el incidente, la ubicación, el viaje interrumpido y el motivo.
2. **Si el pasajero acepta el micro de reemplazo**, conserva el pasaje y continúa sin un nuevo cobro. El sistema registra los viajes y micros participantes. Si el reemplazo pertenece a otra línea, la operación requiere que el sindicato defina y autorice el acuerdo.
3. **Si hay avería y el pasajero prefiere continuar por su cuenta**, la práctica informada es devolver el importe completo en efectivo para que tome la línea que desee. El sistema deberá marcar el pasaje como cancelado/reembolsado y registrar quién autorizó y entregó el efectivo. No se calcula una devolución por tramo recorrido.
4. No se emite reembolso y a la vez se deja válido el mismo ticket de reemplazo. Así se evita devolver el dinero por un servicio que el pasajero continúa utilizando.

La devolución en efectivo no puede confirmarse automáticamente por el backend: debe quedar un registro auditable del motivo, importe, pasaje, viaje, micro, usuario que autorizó y usuario que entregó/recibió el efectivo. Si después se integra tarjeta, su devolución se procesará por separado en la pasarela y solo figurará como confirmada tras respuesta del proveedor.

## Decisiones pendientes antes del MER

1. Obtener del RUAT/registro/autorización de cada unidad la capacidad sentada y la de pie autorizada. La sugerencia conservadora del sistema usa las plazas sentadas; el sistema no estima cupos solo por el tamaño visual del micro.
2. Confirmar si en cada trasbordo normal el reemplazo es de la misma línea o puede ser de otra y bajo qué acuerdo.
3. Definir cómo se identifica el pasaje al abordar y cómo confirma el pasajero el pago en efectivo (por ejemplo, QR/código y recibo). También definir si habrá pasajeros sin cuenta.
4. Definir cómo se registra el descenso y qué actor confirma una devolución en efectivo.
5. Revisar periódicamente la escala tarifaria oficial y registrar quién la actualiza y desde qué fecha aplica. La Ley Municipal 1913 promulgada el 5 de octubre de 2026 establece los valores base usados por el prototipo.
6. Definir qué documento valida la edad menor de 12, qué acredita a un escolar/universitario, periodo de validez y almacenamiento seguro de las evidencias.
7. Confirmar si pagos electrónicos con tarjeta serán parte de la primera versión o una fase posterior.
8. Solicitar a cada sindicato sus reglas de turno/descanso antes de diseñar calendario o liquidaciones entre líneas.
9. Definir fuente GPS, frecuencia de actualización y conservación del historial; el radio de 5 km es de búsqueda de proximidad, no distancia de ruta.

## Diferencia respecto al backend actual

El backend ya contiene endpoints para los flujos anteriores. El catálogo actualizado usa tarifas distintas para primaria, secundaria, universidad, adulto mayor, discapacidad, menor de 12 y categorías exentas. Las solicitudes de beneficio requieren revisión administrativa. El aforo usa plazas sentadas como sugerencia conservadora y mantiene el límite autorizado por unidad. Los pagos con tarjeta son simulados y el pago en efectivo se registra al abordar. Todavía faltan el lector QR en la interfaz, el almacenamiento seguro de evidencias y las reglas de turnos que proporcionen los sindicatos.
