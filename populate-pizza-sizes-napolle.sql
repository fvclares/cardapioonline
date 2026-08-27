-- Popula tamanhos para Napollè (8c38aba3-3d21-474d-87dc-7e33fa5a0e60)
-- Execute após fix-pizza-sizes.sql
BEGIN;
DELETE FROM public.pizza_sizes WHERE store_id='8c38aba3-3d21-474d-87dc-7e33fa5a0e60';
INSERT INTO public.pizza_sizes (store_id, name, slices, max_flavors, display_order, is_active) VALUES
('8c38aba3-3d21-474d-87dc-7e33fa5a0e60', 'P (4 fatias)', 4, 1, 1, true),
('8c38aba3-3d21-474d-87dc-7e33fa5a0e60', 'M (6 fatias)', 6, 1, 2, true),
('8c38aba3-3d21-474d-87dc-7e33fa5a0e60', 'G (8 fatias)', 8, 2, 3, true),
('8c38aba3-3d21-474d-87dc-7e33fa5a0e60', 'Família (12 fatias)', 12, 4, 4, true);
COMMIT;
-- Verificação
-- select name, slices, max_flavors from pizza_sizes where store_id='8c38aba3-3d21-474d-87dc-7e33fa5a0e60' order by display_order;
