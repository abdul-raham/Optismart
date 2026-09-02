# OptiSmart Portal — Implementation & Workflow Guide (v4 Update)

This document provides a comprehensive explanation of all system updates, business logic corrections, operational workflows, and SQL scripts implemented today.

---

## 1. The Sales Report Discrepancy & Pending Orders Fix

### The Problem
Previously, the sales reports and DSA summaries counted **all created orders** (including `pending`, `processing`, `dispatched`, etc.) as "Cameras Sold" and "Delivered Revenue". This inflated DSA performance figures (e.g., showing 139 cameras sold instead of the actual 55 delivered units).

### The Business Rule
> **Core Rule**: *"Pending orders do NOT count as sold. Only orders with status `delivered` represent actual sales and revenue."*

### Implementation Highlights (`src/pages/admin/Reports.tsx`)
- **Cameras Sold**: Calculated strictly when `status === 'delivered'`.
- **Delivered Revenue**: Calculated strictly when `status === 'delivered'`.
- **Pending Orders**: Explicitly tracks active pipeline orders (`pending`, `approved`, `processing`, `dispatched`, `rescheduled`).
- **Total Originated Orders**: Maintained for full historical and audit visibility.
- **Table & Export Transparency**: Updated UI headers and CSV/Excel exports to display:
  - `Delivered Cameras`
  - `Delivered Orders`
  - `Pending Orders`
  - `Total Originated Orders`
  - `Delivered Revenue (₦)`

---

## 2. Legacy / Historical Pending Order Fulfillment Flow

### The Problem
Historical pending orders created before multi-branch inventory tracking was introduced could not be marked as delivered without attempting to deduct current store inventory or requiring manual branch selection.

### Solution: Smart Auto-Detect Fulfillment (`src/pages/admin/Orders.tsx`)
- **No Manual Checkboxes**: We removed manual "Historical Order Cleanup" toggle checkboxes to prevent human error, confusion across multiple DSAs, and race conditions.
- **Automated Inventory Detection**:
  - When an admin clicks **Mark Delivered**, the system checks physical inventory across all branch locations for that product.
  - **If Inventory Exists**: The branch selection UI is shown, and stock is deducted via `fulfill_order_from_location`.
  - **If No Inventory Exists** (e.g., historical orders or un-tracked items): The modal displays an automated message:
    > *"No inventory recorded for this product — The order will be marked as Delivered and commissions will be recorded without deducting stock."*
  - Admin clicks **Confirm Delivery** once to fulfill the order cleanly with an automated audit note appended.

---

## 3. Physical Inventory Count Override Tool

### Overview (`src/pages/admin/Products.tsx` & `feature_update_v4.sql`)
To match database inventory numbers with actual physical store shelf counts:
- Super Admins / Authorized Admins can navigate to **Products ➔ Inventory** and select **Set Physical Count**.
- Specifying a target quantity (e.g. setting shelf count to `15` units) calculates the variance against previous database inventory.
- The stored function `public.inventory_set_physical_count` updates branch inventory and logs a corresponding `stock_in` or `stock_out` audit entry in `stock_movements`.

---

## 4. Granular Admin Permissions & Admin Profile View

1. **Permission Flags**: Added granular permission toggles to `public.users`:
   - `can_manage_inventory`
   - `can_manage_users`
   - `can_manage_expenses`
   - `can_view_reports`
   - `can_delete_records`
2. **Admin Profile View (`UserDetail.tsx`)**:
   - Admin user cards now display administrative permission settings and inventory audit logs executed by that admin.

---

## 5. SQL Migration Script Instructions (`feature_update_v4.sql`)

Run the contents of [feature_update_v4.sql](file:///c:/Users/Abdurrahman/Documents/Optismart/feature_update_v4.sql) in your **Supabase SQL Editor**. It is idempotent and safe to run multiple times.

```sql
-- OPTISMART FEATURE UPDATE V4
-- Granular Super Admin Permission Toggles & Physical Stock Audit Override

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_manage_inventory BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_manage_users BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_manage_expenses BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_view_reports BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_delete_records BOOLEAN NOT NULL DEFAULT false;

-- Direct Stock Count Override (Set Physical Inventory Count)
CREATE OR REPLACE FUNCTION public.inventory_set_physical_count(
  p_product_id UUID,
  p_location_id UUID,
  p_target_quantity INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_qty INTEGER := 0;
  v_diff INTEGER := 0;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required. Current user ID (%) is not marked as admin.', auth.uid();
  END IF;

  IF p_target_quantity < 0 THEN
    RAISE EXCEPTION 'Target physical quantity cannot be negative';
  END IF;

  SELECT COALESCE(quantity, 0) INTO v_old_qty
  FROM public.product_inventory
  WHERE product_id = p_product_id AND location_id = p_location_id;

  v_diff := p_target_quantity - v_old_qty;

  INSERT INTO public.product_inventory (product_id, location_id, quantity, updated_at)
  VALUES (p_product_id, p_location_id, p_target_quantity, NOW())
  ON CONFLICT (product_id, location_id)
  DO UPDATE SET quantity = p_target_quantity, updated_at = NOW();

  IF v_diff != 0 THEN
    INSERT INTO public.stock_movements(movement_type, product_id, quantity, to_location_id, notes, created_by_auth_id)
    VALUES (
      CASE WHEN v_diff >= 0 THEN 'stock_in' ELSE 'stock_out' END,
      p_product_id,
      ABS(v_diff),
      p_location_id,
      COALESCE(p_notes, 'Physical Stock Count Audit (Set to ' || p_target_quantity || ' units, previous: ' || v_old_qty || ')'),
      auth.uid()
    );
  END IF;

  PERFORM public.refresh_product_stock(p_product_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.inventory_set_physical_count(UUID, UUID, INTEGER, TEXT) TO authenticated;
```

---

## 6. Verification Status

- **TypeScript Compilation**: 0 Errors (`tsc` passed).
- **Vite Production Build**: Successfully built bundle (`npm run build`).
- **Git Repository**: All code changes committed and pushed to `main`.
