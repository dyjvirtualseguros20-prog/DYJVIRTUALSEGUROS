-- ═══════════════════════════════════════════════════════════════════════════
--  Dar acceso a /admin a un asesor
--
--  1. Crea el usuario en Supabase → Authentication → Users → "Add user"
--     (email + contraseña, marca "Auto Confirm User").
--  2. Cambia el correo de abajo y ejecuta este script en el SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.admin_users (user_id)
select id from auth.users where email = 'CORREO_DEL_ASESOR@ejemplo.com'
on conflict (user_id) do nothing;

-- Comprobar:
select u.email, a.created_at
from public.admin_users a
join auth.users u on u.id = a.user_id;

-- Para quitar el acceso:
-- delete from public.admin_users
-- where user_id = (select id from auth.users where email = 'CORREO_DEL_ASESOR@ejemplo.com');
