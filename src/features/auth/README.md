# Auth Feature Module

Módulo de autenticación con diseño split-screen moderno.

## Estructura

```
auth/
├── login/
│   ├── views/
│   │   └── LoginView.vue          # Vista principal (container)
│   └── components/
│       ├── LoginForm.vue           # Formulario de login (lado izquierdo)
│       └── LoginHero.vue           # Hero visual (lado derecho)
└── README.md
```

## Diseño

### Split Screen Layout

- **Izquierda (40%)**: Formulario de login con logo, campos, y CTA
- **Derecha (60%)**: Hero visual con branding, gradientes, animaciones

### Paleta de colores

- **Primary**: Emerald (600-950) — verde esmeralda de la marca Hound
- **Secondary**: Teal (400-950) — verde azulado para contraste
- **Accent**: Cyan (300-500) — detalles y highlights

### Logos disponibles

- `/public/hounfeLogos/primary.png` — logo principal (2000x2000 PNG)
- `/public/hounfeLogos/secondary.png` — logo secundario (2000x2000 PNG)

## Componentes

### LoginView.vue

- Container principal con responsive layout
- Maneja estado de email/password
- Emite eventos de submit

### LoginForm.vue

- Formulario con validación
- Toggle de mostrar/ocultar contraseña
- Links a "Olvidé mi contraseña" y "Registrate"
- Botón con gradient y animaciones

### LoginHero.vue

- Background con gradient animado (emerald → teal → emerald)
- Blobs animados con blur para profundidad
- Grid decorativo sutil
- Logo flotante con efecto hover
- Hero text con shimmer effect
- 3 feature cards glassmorphism con hover states

## Animaciones

- **Fade-in**: Entrada suave del formulario
- **Blob**: Movimiento orgánico del fondo
- **Text shimmer**: Efecto de brillo en el título
- **Hover states**: Escalado, rotación, y shadow en cards
- **Staggered animations**: Cards aparecen con delay progresivo

## Layout System

El router usa `meta.layout` para determinar qué layout renderizar:

- `layout: 'auth'` → AuthLayout (sin sidebar/navbar)
- `layout: 'dashboard'` → DashboardLayout (con sidebar/navbar)

Ver `/src/app/App.vue` para la lógica de switching.

## Próximos pasos (TODO)

- [ ] Integrar con sistema de autenticación real (Better Auth, Supabase, etc.)
- [ ] Agregar validación de formulario con Zod + VeeValidate
- [ ] Implementar ruta `/forgot-password`
- [ ] Implementar ruta `/signup`
- [ ] Agregar OAuth providers (Google, GitHub, etc.)
- [ ] Agregar manejo de errores y toast notifications
- [ ] Implementar redirect después de login exitoso
