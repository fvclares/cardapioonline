-- Repopula preços por tamanho para pizzas Napollè
-- Store: 8c38aba3-3d21-474d-87dc-7e33fa5a0e60
-- P = base -10, M = base -5, G = base, Família = base +14 (ajuste os valores abaixo se quiser)
BEGIN;

-- Garante que base_price está correto (usa valor atual da pizza como preço G)
-- Insere/atualiza product_size_prices

INSERT INTO public.product_size_prices (product_id, size_id, price)
SELECT p.id, s.id,
  CASE s.name
    WHEN 'P (4 fatias)' THEN GREATEST(0, p.base_price - 10)
    WHEN 'M (6 fatias)' THEN GREATEST(0, p.base_price - 5)
    WHEN 'G (8 fatias)' THEN p.base_price
    WHEN 'Família (12 fatias)' THEN p.base_price + 14
    ELSE p.base_price
  END
FROM public.products p
JOIN public.pizza_sizes s ON s.store_id = p.store_id
WHERE p.store_id = '8c38aba3-3d21-474d-87dc-7e33fa5a0e60'
  AND p.is_pizza = true
  AND s.is_active = true
ON CONFLICT (product_id, size_id) DO UPDATE SET price = EXCLUDED.price;

-- Verificação
-- SELECT p.codigo, p.name, s.name as tamanho, ps.price
-- FROM products p
-- JOIN product_size_prices ps ON ps.product_id = p.id
-- JOIN pizza_sizes s ON s.id = ps.size_id
-- WHERE p.store_id='8c38aba3-3d21-474d-87dc-7e33fa5a0e60'
-- ORDER BY p.codigo, s.display_order;

COMMIT;
