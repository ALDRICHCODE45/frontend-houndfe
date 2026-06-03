/**
 * Human labels and 1-liner descriptions for backend permissions.
 *
 * The backend exposes permissions as `(subject, action)` pairs (e.g.
 * `TenantMembership:create`). Those technical strings are useful for
 * debugging, support tickets, and direct correlation with backend
 * endpoints — they are still rendered as a small monospace badge in the
 * UI — but they are NOT what the user reads first when assigning a role.
 *
 * This module maps every (subject, action) the backend exposes to:
 *   - a short, action-oriented label in Rioplatense Spanish (the "title")
 *   - a 1-liner description explaining the implication (the "subtitle")
 *
 * It also enumerates subjects that should be HIDDEN from the role
 * permissions UI because they are not meant for role composition:
 *   - `all`     → the super-admin wildcard. Assigning it grants every
 *                 permission; not a building block for granular roles.
 *   - `Order`   → deprecated module (see backend RBAC audit § 7.3).
 *
 * Backend registry reference:
 *   houndfe-backend/docs/backend-requests/rbac-frontend-permissions-audit.md
 *   section 2.2 AppSubjects table.
 */

export const HIDDEN_SUBJECTS = ['all', 'Order'] as const

export function isSubjectHidden(subject: string): boolean {
  return (HIDDEN_SUBJECTS as readonly string[]).includes(subject)
}

/** Human label for each backend subject. */
const SUBJECT_LABELS: Record<string, string> = {
  TenantMembership: 'Miembros de la sucursal',
  User: 'Usuarios',
  Tenant: 'Sucursales',
  Role: 'Roles',
  Brand: 'Marcas',
  Category: 'Categorías',
  Product: 'Productos',
  Sale: 'Ventas',
  SaleComment: 'Comentarios de ventas',
  Customer: 'Clientes',
  Promotion: 'Promociones',
  File: 'Archivos',
  Employee: 'Colaboradores',
  EmployeeDocument: 'Documentos de colaboradores',
  EmployeeEmergencyContact: 'Contactos de emergencia',
  EmployeeSalary: 'Compensaciones',
  EmployeeTimeOff: 'Ausencias',
  EmployeeTimeOffMedical: 'Incapacidades médicas',
  GlobalPriceList: 'Listas de precios globales',
}

export function getSubjectLabel(subject: string): string {
  return SUBJECT_LABELS[subject] ?? subject
}

interface PermissionCopy {
  label: string
  description: string
}

/**
 * Per (subject, action) copy.
 *
 * Conventions:
 *   - Labels are action-oriented and use voseo ("Crear", "Agregar",
 *     "Editar", "Quitar", "Ver"). Avoid passive phrasing.
 *   - Descriptions explain WHAT the permission unlocks and any caveat
 *     worth knowing (e.g. "La cuenta del usuario sigue existiendo").
 *   - `manage` is the backend wildcard; describe it as "Gestión completa".
 */
const PERMISSION_COPY: Record<string, Record<string, PermissionCopy>> = {
  TenantMembership: {
    create: {
      label: 'Agregar miembros a la sucursal',
      description:
        'Invitar usuarios existentes y asignarles un rol dentro de esta sucursal.',
    },
    read: {
      label: 'Ver miembros de la sucursal',
      description: 'Listar quiénes pertenecen a esta sucursal y con qué rol.',
    },
    update: {
      label: 'Cambiar rol de miembros',
      description: 'Modificar el rol que un usuario tiene dentro de esta sucursal.',
    },
    delete: {
      label: 'Quitar miembros de la sucursal',
      description:
        'Sacar a un usuario de esta sucursal. La cuenta del usuario sigue existiendo.',
    },
    manage: {
      label: 'Gestión completa de miembros',
      description:
        'Agregar, ver, cambiar rol y quitar miembros de esta sucursal sin restricciones.',
    },
  },

  User: {
    create: {
      label: 'Crear usuarios nuevos',
      description:
        'Dar de alta una cuenta nueva en la plataforma (email, contraseña, nombre).',
    },
    read: {
      label: 'Ver listado de usuarios',
      description: 'Listar todos los usuarios de la sucursal actual.',
    },
    update: {
      label: 'Editar usuarios',
      description: 'Modificar datos básicos de un usuario, como el nombre.',
    },
    delete: {
      label: 'Desactivar usuarios',
      description:
        'Marcar un usuario como inactivo. No se borra de la base; puede reactivarse.',
    },
    manage: {
      label: 'Gestión completa de usuarios',
      description:
        'Crear, ver, editar y desactivar cualquier usuario sin restricciones.',
    },
  },

  Tenant: {
    create: {
      label: 'Crear sucursales',
      description: 'Dar de alta una sucursal nueva en la plataforma.',
    },
    read: {
      label: 'Ver sucursales',
      description: 'Listar todas las sucursales existentes.',
    },
    update: {
      label: 'Editar sucursales',
      description: 'Modificar datos de una sucursal (nombre, estado, etc).',
    },
    delete: {
      label: 'Desactivar sucursales',
      description:
        'Marcar una sucursal como inactiva. Los datos se conservan pero queda inaccesible.',
    },
    manage: {
      label: 'Gestión completa de sucursales',
      description:
        'Crear, editar y desactivar cualquier sucursal sin restricciones. Asignar con extremo cuidado.',
    },
  },

  Role: {
    create: {
      label: 'Crear roles',
      description:
        'Definir un nuevo rol con su combinación de permisos para asignar a usuarios.',
    },
    read: {
      label: 'Ver roles',
      description: 'Listar todos los roles disponibles y los permisos que tienen.',
    },
    update: {
      label: 'Editar roles',
      description: 'Modificar el nombre, descripción o permisos de un rol existente.',
    },
    delete: {
      label: 'Eliminar roles',
      description:
        'Borrar un rol. Los usuarios que lo tengan asignado pueden quedar sin permisos en esta sucursal.',
    },
    manage: {
      label: 'Gestión completa de roles',
      description:
        'Crear, editar y eliminar roles, y asignarles cualquier combinación de permisos.',
    },
  },

  Brand: {
    create: {
      label: 'Crear marcas',
      description: 'Dar de alta marcas nuevas en el catálogo compartido de productos.',
    },
    read: {
      label: 'Ver marcas',
      description: 'Listar todas las marcas disponibles en el catálogo.',
    },
    update: {
      label: 'Editar marcas',
      description: 'Modificar el nombre o datos de una marca existente.',
    },
    delete: {
      label: 'Eliminar marcas',
      description:
        'Borrar una marca. Los productos asociados pueden verse afectados.',
    },
    manage: {
      label: 'Gestión completa de marcas',
      description: 'Crear, editar y eliminar marcas sin restricciones.',
    },
  },

  Category: {
    create: {
      label: 'Crear categorías',
      description: 'Dar de alta categorías nuevas en el catálogo compartido.',
    },
    read: {
      label: 'Ver categorías',
      description: 'Listar todas las categorías de productos disponibles.',
    },
    update: {
      label: 'Editar categorías',
      description: 'Modificar el nombre o datos de una categoría existente.',
    },
    delete: {
      label: 'Eliminar categorías',
      description:
        'Borrar una categoría. Los productos asociados pueden verse afectados.',
    },
    manage: {
      label: 'Gestión completa de categorías',
      description: 'Crear, editar y eliminar categorías sin restricciones.',
    },
  },

  Product: {
    create: {
      label: 'Crear productos',
      description: 'Dar de alta productos nuevos en el catálogo de la sucursal.',
    },
    read: {
      label: 'Ver productos',
      description:
        'Listar productos del catálogo, incluyendo variantes, lotes, precios e imágenes.',
    },
    update: {
      label: 'Editar productos',
      description:
        'Modificar productos, variantes, lotes, precios e imágenes. También cubre operaciones de inventario.',
    },
    delete: {
      label: 'Eliminar productos',
      description: 'Borrar productos del catálogo de la sucursal.',
    },
    manage: {
      label: 'Gestión completa de productos',
      description:
        'Crear, ver, editar y eliminar productos y todo lo relacionado (variantes, lotes, precios, imágenes).',
    },
  },

  Sale: {
    create: {
      label: 'Registrar ventas',
      description: 'Abrir borradores de venta y cobrarlos en el POS.',
    },
    read: {
      label: 'Ver ventas',
      description: 'Consultar el listado y detalle de ventas de la sucursal.',
    },
    update: {
      label: 'Editar ventas',
      description:
        'Modificar borradores, agregar pagos a ventas con deuda, asignar vendedor, cambiar fecha de vencimiento.',
    },
    delete: {
      label: 'Eliminar ventas',
      description: 'Borrar borradores de venta antes de cobrarlos.',
    },
    manage: {
      label: 'Gestión completa de ventas',
      description:
        'Registrar, ver, editar y eliminar ventas sin restricciones, incluyendo pagos y vendedores.',
    },
  },

  SaleComment: {
    create: {
      label: 'Comentar en ventas',
      description: 'Agregar comentarios a una venta para dejar notas internas.',
    },
    read: {
      label: 'Ver comentarios de ventas',
      description: 'Leer los comentarios que otros usuarios dejaron en una venta.',
    },
    update: {
      label: 'Editar comentarios propios',
      description: 'Modificar los comentarios de venta que uno mismo creó.',
    },
    delete: {
      label: 'Eliminar comentarios propios',
      description:
        'Borrar los comentarios de venta que uno mismo creó. Los de otros usuarios no se tocan.',
    },
    manage: {
      label: 'Gestión completa de comentarios',
      description:
        'Crear, ver, editar y eliminar cualquier comentario de venta, incluso de otros usuarios.',
    },
  },

  Customer: {
    create: {
      label: 'Crear clientes',
      description: 'Dar de alta clientes nuevos en la sucursal, con sus direcciones.',
    },
    read: {
      label: 'Ver clientes',
      description: 'Listar y consultar el detalle de clientes de la sucursal.',
    },
    update: {
      label: 'Editar clientes',
      description: 'Modificar datos de clientes y sus direcciones.',
    },
    delete: {
      label: 'Eliminar clientes',
      description: 'Borrar clientes de la sucursal.',
    },
    manage: {
      label: 'Gestión completa de clientes',
      description: 'Crear, ver, editar y eliminar clientes y sus direcciones.',
    },
  },

  Promotion: {
    create: {
      label: 'Crear promociones',
      description: 'Dar de alta promociones nuevas para la sucursal.',
    },
    read: {
      label: 'Ver promociones',
      description: 'Listar y consultar el detalle de promociones de la sucursal.',
    },
    update: {
      label: 'Editar promociones',
      description: 'Modificar promociones existentes, incluyendo finalizarlas manualmente.',
    },
    delete: {
      label: 'Eliminar promociones',
      description: 'Borrar promociones de la sucursal.',
    },
    manage: {
      label: 'Gestión completa de promociones',
      description: 'Crear, ver, editar y eliminar promociones sin restricciones.',
    },
  },

  File: {
    create: {
      label: 'Subir archivos',
      description: 'Cargar archivos nuevos (imágenes, documentos) en la sucursal.',
    },
    read: {
      label: 'Ver archivos',
      description: 'Consultar metadatos de archivos cargados.',
    },
    delete: {
      label: 'Eliminar archivos',
      description: 'Borrar archivos cargados, tanto del almacenamiento como del registro.',
    },
    manage: {
      label: 'Gestión completa de archivos',
      description: 'Subir, ver y eliminar archivos sin restricciones.',
    },
  },

  Employee: {
    create: {
      label: 'Registrar colaboradores',
      description: 'Dar de alta colaboradores nuevos con sus datos personales y laborales.',
    },
    read: {
      label: 'Ver colaboradores',
      description: 'Consultar el listado y perfil detallado de colaboradores.',
    },
    update: {
      label: 'Editar colaboradores',
      description: 'Modificar datos personales, laborales y de contacto de colaboradores.',
    },
    delete: {
      label: 'Desactivar colaboradores',
      description: 'Dar de baja a un colaborador. Los datos históricos se conservan.',
    },
    manage: {
      label: 'Gestión completa de colaboradores',
      description:
        'Registrar, ver, editar y desactivar colaboradores sin restricciones.',
    },
  },

  EmployeeDocument: {
    create: {
      label: 'Subir documentos de colaboradores',
      description: 'Cargar documentos (INE, CURP, contratos, etc.) al expediente del colaborador.',
    },
    read: {
      label: 'Ver documentos de colaboradores',
      description: 'Consultar y descargar documentos del expediente del colaborador.',
    },
    delete: {
      label: 'Eliminar documentos de colaboradores',
      description: 'Borrar documentos del expediente del colaborador.',
    },
    manage: {
      label: 'Gestión completa de documentos',
      description: 'Subir, ver y eliminar documentos de colaboradores sin restricciones.',
    },
  },

  EmployeeEmergencyContact: {
    create: {
      label: 'Agregar contactos de emergencia',
      description: 'Registrar contactos de emergencia para un colaborador.',
    },
    read: {
      label: 'Ver contactos de emergencia',
      description: 'Consultar los contactos de emergencia registrados.',
    },
    update: {
      label: 'Editar contactos de emergencia',
      description: 'Modificar datos de los contactos de emergencia de un colaborador.',
    },
    delete: {
      label: 'Eliminar contactos de emergencia',
      description: 'Borrar un contacto de emergencia del expediente.',
    },
    manage: {
      label: 'Gestión completa de contactos de emergencia',
      description:
        'Agregar, ver, editar y eliminar contactos de emergencia sin restricciones.',
    },
  },

  EmployeeSalary: {
    create: {
      label: 'Registrar ajustes salariales',
      description: 'Crear registros de compensación (alta, aumento, ajuste) para un colaborador.',
    },
    read: {
      label: 'Ver historial de compensaciones',
      description: 'Consultar el historial salarial y ajustes de un colaborador.',
    },
    manage: {
      label: 'Gestión completa de compensaciones',
      description:
        'Registrar y consultar compensaciones sin restricciones. Información sensible.',
    },
  },

  EmployeeTimeOff: {
    create: {
      label: 'Solicitar ausencias',
      description: 'Crear solicitudes de ausencia (vacaciones, permiso, etc.) para colaboradores.',
    },
    read: {
      label: 'Ver ausencias',
      description: 'Consultar las solicitudes de ausencia y su estado de aprobación.',
    },
    update: {
      label: 'Aprobar o rechazar ausencias',
      description: 'Cambiar el estado de una solicitud de ausencia (aprobar, rechazar).',
    },
    delete: {
      label: 'Cancelar ausencias',
      description: 'Eliminar una solicitud de ausencia pendiente.',
    },
    manage: {
      label: 'Gestión completa de ausencias',
      description:
        'Solicitar, ver, aprobar y cancelar ausencias de cualquier colaborador.',
    },
  },

  EmployeeTimeOffMedical: {
    read: {
      label: 'Ver incapacidades médicas',
      description:
        'Consultar las incapacidades médicas de colaboradores. Información confidencial.',
    },
  },

  GlobalPriceList: {
    create: {
      label: 'Crear listas de precios globales',
      description:
        'Dar de alta listas de precios que se comparten entre todas las sucursales.',
    },
    read: {
      label: 'Ver listas de precios globales',
      description:
        'Consultar las listas de precios disponibles para los productos.',
    },
    update: {
      label: 'Editar listas de precios globales',
      description: 'Modificar listas de precios existentes.',
    },
    delete: {
      label: 'Eliminar listas de precios globales',
      description: 'Borrar listas de precios completas.',
    },
    manage: {
      label: 'Gestión completa de listas de precios',
      description:
        'Crear, ver, editar y eliminar listas de precios globales sin restricciones.',
    },
  },
}

/** Generic fallback labels for actions when the (subject, action) pair is unknown. */
const ACTION_FALLBACK_LABELS: Record<string, string> = {
  create: 'Crear',
  read: 'Ver',
  update: 'Editar',
  delete: 'Eliminar',
  manage: 'Gestión completa',
}

export function getPermissionLabel(subject: string, action: string): string {
  const subjectCopy = PERMISSION_COPY[subject]
  const exact = subjectCopy?.[action]
  if (exact) return exact.label

  const actionLabel = ACTION_FALLBACK_LABELS[action] ?? action
  const subjectLabel = getSubjectLabel(subject)
  return `${actionLabel}: ${subjectLabel}`
}

export function getPermissionDescription(subject: string, action: string): string {
  return PERMISSION_COPY[subject]?.[action]?.description ?? ''
}
