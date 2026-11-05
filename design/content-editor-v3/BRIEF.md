# Brief: Contenido del producto, v3 (rediseño completo)

## Qué dijo el usuario (verbatim, L72)
"estoy viendo la ui de TODA esta seccion de "Contenido" y no me gusta para nada ... mucha de mi inconformidad viene de los inputs, viene de los selects y tambien mucho del acomodo, ese badge de "Con dato", "Desconocido", etc.. al lado derecho del input, no me gusta para nada ... siento que esta de mas ... los dropdownmenus, en todas las opciones hay como un padding buttom debajo del texto dentro de la opcion ... en los selects, no hay ningun efecto hover dentro de las opciones, en los multi selects largos, no hay una barra de busqueda ... como una ui muy antigua, no la siento para nada moderna ... nada parece tener orden, nada parece tener un sentido"

## Diagnóstico del arquitecto (por qué se siente vieja)
1. Muro de formulario: 21 filas, cada una con una caja de 44px y un borde oscuro (`--hf-field-border` #8593a3). Todo pesa igual y no hay jerarquía.
2. El chip de estado repite lo que ya dice el campo: si dice "Croquetas", ya tiene dato. Son tres columnas (campo + chip + ⋮) para una sola idea.
3. «Desconocido» y «No aplica» viven escondidos en un ⋮ aparte del control, y cuando se eligen el campo desaparece y queda un «—».
4. El orden es alfabético, sin grupos: «Análisis clínico» al lado de «Cantidad contenida».
5. Los desplegables no tienen buscador, ni hover visible, y dejan un hueco bajo cada opción.
6. Hay ruido alrededor: «Publicación próximamente» deshabilitado, ⋮ suelto en el pie, «Ficha para el catálogo» + chip «Borrador» + «Historial» + «Solo faltantes» + contador, todo peleando arriba.

## Principios obligatorios para TODAS las direcciones
- Sin columna de chip de estado. El estado se expresa en el propio valor:
  - con dato: el valor;
  - sin dato: un placeholder tenue;
  - Desconocido / No aplica: el texto en gris itálico dentro del mismo control («No aplica»), elegible DESDE el mismo desplegable (opciones separadas al pie de la lista: «No lo sé» y «No aplica») o desde un botón fantasma que aparece al pasar el cursor en los campos de texto;
  - Requerido para publicar y vacío: un punto/marca ámbar junto a la etiqueta (`--hf-warning`), nunca rojo.
- Controles modernos: en reposo, borde suave (`--hf-border`); al pasar el cursor, `--hf-field-border`; con foco, el anillo de 2px `--hf-focus`. 40px de alto dentro del editor (44px de área táctil en mobile). Radio de 6px.
- Combobox/desplegable propio, interactivo en el artboard (JS inline):
  - popover con sombra suave y radio de 8px;
  - opciones de 36px con el texto centrado verticalmente, SIN hueco inferior;
  - hover/teclado resaltado `--hf-active-soft`; check a la derecha de la elegida;
  - buscador arriba cuando hay más de 7 opciones; navegación con flechas, Enter y Esc;
  - multi: valores como chips dentro del control (máximo 2 visibles y luego «+N»), checkbox por opción.
- Unidades: un solo control compuesto «[ 10 ][ kg ▾ ]» con un divisor interno; rango «10 – 40 kg».
- Grupos con sentido (la etiqueta del grupo es 13px/600 `--hf-muted`, sin mayúsculas):
  - **Para quién**: Especie, Etapa de vida, Tamaño de raza, Peso de la mascota.
  - **Qué es**: Formato del alimento, Función del alimento, Textura, Procesamiento, Origen de la proteína, Comportamiento en el agua.
  - **Fórmula**: Ingredientes, Composición, Análisis clínico (Interno).
  - **Contenido y empaque**: Tipo de contenido, Peso neto, Volumen neto, Cantidad contenida, Unidades por paquete, Tipo de envase, Formato de venta.
  - **Uso**: Instrucciones de uso.
- Encabezado calmado: título «Contenido», un solo indicador de avance («Faltan 3» o «Completo»), y «Historial» como botón fantasma con ícono. Sin el chip «Borrador» suelto (el estado va en la barra de guardado).
- Barra de guardado: estado a la izquierda («Guardado hace 2 min» / «3 cambios sin guardar» con un punto ámbar), Descartar (ghost) y Guardar (primario) a la derecha, deshabilitado sin cambios. Sin «Publicación próximamente» y sin el ⋮ suelto.
- «Interno» se mantiene como marca discreta (ícono de candado + «Interno», 12px muted).
- Copy en español neutro de México, con tú, sentence case, sin mayúsculas sostenidas y sin ids.
- Tokens SOLO de design/system.md (light + dark, con un toggle de tema en el artboard). La fuente es Geist, con su fallback. 1440×900, más una vista mobile de 390 accesible con un toggle «Móvil».

## Datos reales (Alimento para Cachorro Raza Mediana 3 kg; familia Alimento; una presentación «Producto»)
- Título comercial: «Alimento para Cachorro Raza Mediana 3 kg». Descripción: «Alimento para cachorro alto en fibra y perfecto para todo tipo de perro.»
- Pregunta de presentación: ¿Cómo se mide el contenido? Peso · Volumen · Piezas · Largo · Área · No sé (elegido: Peso). Fuente: Etiqueta del empaque · Ficha del fabricante · Sitio del fabricante · Otro (elegido: Etiqueta del empaque), Revisada el 4 nov 2026.
- Valores:
  - Especie: multi Perro, Gato (opciones: Perro, Gato, Ave, Pez, Roedor, Conejo, Hurón, Reptil, Tortuga, Caballo: 10, con buscador).
  - Etapa de vida: Cachorro (Cachorro, Junior, Adulto, Senior, Todas las etapas).
  - Tamaño de raza: multi Mediano, Pequeño (Miniatura, Pequeño, Mediano, Grande, Gigante).
  - Peso de la mascota: 10–40 kg.
  - Formato del alimento: VACÍO y Requerido para publicar (Croquetas, Lata, Sobre, Snack, Premio, Polvo, Líquido, Barra: 8, con buscador).
  - Función del alimento: Alimento completo.
  - Textura: Seca.
  - Procesamiento: Extruido.
  - Origen de la proteína: Animal.
  - Comportamiento en el agua: No lo sé.
  - Ingredientes: «Pollo, arroz, cebada, pulpa de remolacha, aceite de pescado».
  - Composición: vacío.
  - Análisis clínico (Interno): «Proteína cruda mín. 26 %, Grasa cruda mín. 16 %, Fibra cruda máx. 4 %, Humedad máx. 10 %».
  - Tipo de contenido: Peso.
  - Peso neto: 3 kg.
  - Volumen neto: No aplica.
  - Cantidad contenida: No lo sé.
  - Unidades por paquete: vacío.
  - Tipo de envase: Bolsa.
  - Formato de venta: Individual.
  - Instrucciones de uso: vacío.
- Avance: faltan 4 (Formato del alimento [requerido], Composición, Unidades por paquete, Instrucciones de uso).
