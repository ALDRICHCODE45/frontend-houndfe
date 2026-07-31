Guía Detallada de Rediseño de Interfaz: De Sistema Actual a V0.DEV

Objetivo Central: Rediseñar la interfaz de venta del sistema actual (image_0.png) para adoptar el layout, proporciones y detalles de componentes específicos del diseño de v0.dev (image_1.png). La prioridad es la estructura y el detalle, no los colores exactos (aunque se debe mantener la jerarquía visual clara).
I. Cambios de Proporciones y Layout Principal

Este es el cambio más significativo que afecta a toda la pantalla.

    Proporción General:

        Actual: Panel de Productos (Izquierda) es ~60% del ancho, Panel de Carrito (Derecha) es ~40% del ancho. El carrito es ancho y ocupa mucho espacio.

        NUEVA PROPORCIÓN: Cambiar a un Panel de Productos (Izquierda) que ocupe ~75% del ancho y un Panel de Carrito (Derecha) que ocupe ~25% del ancho. El carrito debe ser mucho más estrecho y vertical.

II. Detalles del Panel de Productos (Izquierda)

El panel izquierdo debe expandirse y contener una cuadrícula más amplia con tarjetas más grandes y detalladas.

    Barra Superior y Navegación:

        Navegación de Pestañas (Venta 1): Mantener las pestañas en la parte superior izquierda, pero integrarlas de forma más limpia dentro de un panel de encabezado que abarque todo el ancho de la nueva sección de productos, similar a la estructura de v0.dev.

        Barra de Búsqueda y Filtros: Rediseñar la sección inferior del encabezado. La barra de búsqueda debe tener un icono de búsqueda estilizado y un panel a la derecha que integre un atajo de teclado (ej: 'CTRL K'), como se ve en v0.dev. Los filtros de categoría (como 'Todo', 'Generales', 'Alimentos') deben ser más pequeños, compactos y agrupados dentro de un panel oscuro dedicado debajo de la búsqueda, en lugar de ser botones grandes y sueltos.

    Cuadrícula y Tarjetas de Productos:

        Cambio de Cuadrícula: Reducir el número de tarjetas visibles para expandir el tamaño de cada una. Pasar de una cuadrícula de 4x1 (o más) a una de 3x2, permitiendo que cada tarjeta sea mucho más grande y detallada.

        Detalles de Tarjeta de Producto:

            Imágenes: Las imágenes de producto (como el 'Pawfect Bites' o el champú en image_1.png) deben ser mucho más grandes y prominentes, ocupando la mayor parte de la tarjeta. (No pequeñas en la parte inferior como en image_0.png).

            Contenido: El nombre del producto, la marca y el precio deben seguir una jerarquía y tamaño de fuente más limpios y pequeños, ubicados debajo de la imagen, exactamente como en el estilo conciso de v0.dev.

            Indicadores Discretos: Incluir indicadores de estado discretos en las esquinas superiores de las tarjetas (como un número de stock '#11' en la esquina superior derecha), como se ve en v0.dev.

III. Panel de Carrito (Derecha - El Detalle Crítico)

Esta sección es la que sufre los cambios más específicos y detallados.

    Encabezado del Carrito: Los botones 'Venta' y 'Pedido' y la opción 'PUBLICO' deben estar más integrados y limpios dentro de un encabezado superior más pequeño y compacto que se ajuste al nuevo ancho estrecho del carrito.

    Diseño de Item del Carrito (DETALLE CLAVE):

        Reemplazar la lista simple por un card horizontal compacto y detallado para cada producto agregado, replicando exactamente la estructura de múltiples líneas vista en v0.dev (ver Ibuprofeno 400 mg):

            Extremo Izquierdo: Un cuadrado pequeño pero detallado (thumbnail de alta resolución) de la imagen del producto (no un icono genérico).

            Sección Central-Arriba: Nombre del producto ('Ibuprofeno 400 mg').

            Sección Central-Debajo: Detalles de especificación específicos ('Rojo - Caja de 30 cpr', 'Caja').

            Sección Central-Abajo (Línea de Cantidad y Acción): Una línea que contenga:

                Un selector de cantidad horizontal compacto ('+' / '1' / '-').

                Un icono de papelera a la derecha del selector para eliminar el item.

            Sección de Precio y Descuentos (Extremo Derecho del Card): Esta es la parte más compleja. El card debe tener múltiples líneas de texto en el extremo derecho:

                Línea 1: Precio unitario o subtotal del item.

                Líneas 2 y 3: Detalles específicos de descuentos (ej: 'Descuento +25%', '+ Descuento extra') y el total del descuento.

                Línea 4: Un enlace de texto para 'Promociones disponibles'.

    Sección de Totales (Abajo):

        Mantener el campo de "Cliente: Sin asignar" y "Asignar cliente".

        Añadir un desglose más detallado antes del total final, incluyendo:

            Número de artículos / Unidades (ej: '1 Artic - 1 Unidad').

            Subtotal y Descuentos como líneas de texto separadas.

        Total Final: El total final 'TOTAL A COBRAR' debe ser grande, prominente y con el monto en blanco, similar al estilo de v0.dev (ver '$90.00' en image_1.png).

        Botón 'Cobrar': El botón grande y amarillo 'Cobrar' debe mantener su estilo, pero ser más amplio y estructurado dentro de su panel, como en v0.dev.
