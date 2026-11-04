# Auth Feature Module

Inicio de sesión (contraseña y OTP) y selección de sucursal.

## Estructura

```
auth/
├── login/
│   ├── views/LoginView.vue            # Tarjeta única sobre la superficie de página
│   └── components/
│       ├── LoginForm.vue              # Email, contraseña y una acción primaria
│       └── LoginOtpForm.vue           # Código de verificación
├── tenant-selection/                  # Lista de sucursales y "Continuar"
├── styles/auth-visual.css             # Roles --hf-* de login y selección
└── README.md
```

## Diseño

Una tarjeta centrada, sin panel de marca ni texto de ayuda permanente, con una sola acción
primaria por pantalla. Los colores salen de los roles `--hf-*` (ver `docs/design-system.md`).

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
