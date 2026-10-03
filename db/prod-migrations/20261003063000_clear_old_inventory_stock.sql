-- Clear all stock not from the Sep 2026 store count; disable old generic items
begin;
insert into inv_stock_movements(movement_type,location_type,location_id,item_id,size_value,qty_change,reference_type,notes)
select 'ADJUSTMENT',b.location_type,b.location_id,b.item_id,b.size_value,-b.qty,'stock_count','Old stock cleared - replaced by Sep 2026 store count'
from inv_stock_balances b join inv_items i on i.id=b.item_id
where b.qty<>0 and i.item_code not like 'SIH-%';
update inv_items set enabled=false where item_code not like 'SIH-%';
commit;
